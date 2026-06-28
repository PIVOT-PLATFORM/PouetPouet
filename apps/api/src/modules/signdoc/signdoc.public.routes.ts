import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { notify } from '../../lib/notify.js'
import { sendSignatureCompletedEmail } from '../../lib/mailer.js'
import { recordEvent } from './signdoc.events.js'
import { activeOrder, canSignNow, dispatchActiveStep, hashToken, isActingRecipient } from './signdoc.workflow.js'
import { finalizeEnvelope } from './signdoc.finalize.js'
import { originalStream } from './signdoc.storage.js'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

// Routes PUBLIQUES de signature — NON authentifiées, protégées par un jeton
// d'accès à usage unique (haché en base). Anti-énumération : toute erreur de
// jeton renvoie 404. Rate-limit appliqué par route (cf. @fastify/rate-limit).
const RL = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }

const ENVELOPE_ACTIVE = new Set(['SENT', 'IN_PROGRESS'])

// Résout un destinataire à partir du jeton en clair. null si introuvable/expiré.
async function resolveByToken(token: string) {
  if (!token || token.length < 10) return null
  const recipient = await prisma.signRecipient.findUnique({
    where: { accessTokenHash: hashToken(token) },
    include: { envelope: true },
  })
  if (!recipient) return null
  if (recipient.tokenExpires && recipient.tokenExpires.getTime() < Date.now()) return null
  return recipient
}

const signSchema = z.object({
  fields: z.array(z.object({ id: z.string().min(1), value: z.string().max(2_000_000) })).max(200),
})

export const signdocPublicRoutes: FastifyPluginAsync = async (app) => {
  // Vue de signature : document + champs du destinataire + état du tour.
  app.get('/:token', RL, async (request, reply) => {
    const { token } = request.params as { token: string }
    const r = await resolveByToken(token)
    if (!r) return reply.status(404).send({ error: 'Lien invalide ou expiré.' })

    const all = await prisma.signRecipient.findMany({ where: { envelopeId: r.envelopeId } })
    const fields = await prisma.signField.findMany({ where: { envelopeId: r.envelopeId, recipientId: r.id } })

    // Marque la première consultation.
    if (r.status === 'SENT' && ENVELOPE_ACTIVE.has(r.envelope.status)) {
      await prisma.signRecipient.update({ where: { id: r.id }, data: { status: 'VIEWED' } })
      await recordEvent(r.envelopeId, 'viewed', { actorLabel: r.name, recipientId: r.id, request })
    }

    return {
      envelope: { id: r.envelope.id, name: r.envelope.name, message: r.envelope.message, pageCount: r.envelope.pageCount, status: r.envelope.status, ordered: r.envelope.ordered },
      recipient: { id: r.id, name: r.name, email: r.email, status: r.status },
      fields,
      yourTurn: ENVELOPE_ACTIVE.has(r.envelope.status) && canSignNow(r.envelope, r, all),
    }
  })

  // Flux du PDF figé (jeton requis).
  app.get('/:token/file', RL, async (request, reply) => {
    const { token } = request.params as { token: string }
    const r = await resolveByToken(token)
    if (!r) return reply.status(404).send({ error: 'Lien invalide ou expiré.' })
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(r.envelope.name)}.pdf`)
    return reply.send(originalStream(r.envelopeId))
  })

  // Signature : enregistre les valeurs des champs, marque SIGNED, fait avancer le workflow.
  app.post('/:token/sign', { ...RL, bodyLimit: 12 * 1024 * 1024 }, async (request, reply) => {
    const { token } = request.params as { token: string }
    const r = await resolveByToken(token)
    if (!r) return reply.status(404).send({ error: 'Lien invalide ou expiré.' })

    const all = await prisma.signRecipient.findMany({ where: { envelopeId: r.envelopeId } })
    if (!ENVELOPE_ACTIVE.has(r.envelope.status) || !canSignNow(r.envelope, r, all)) {
      return reply.status(409).send({ error: "Ce n'est pas (ou plus) votre tour de signer." })
    }

    const { fields } = signSchema.parse(request.body)
    const myFields = await prisma.signField.findMany({ where: { envelopeId: r.envelopeId, recipientId: r.id } })
    const valueById = new Map(fields.map((f) => [f.id, f.value]))
    // Tous les champs requis doivent être remplis.
    const missing = myFields.filter((f) => f.required && !valueById.get(f.id)?.trim())
    if (missing.length > 0) return reply.status(400).send({ error: 'Tous les champs requis doivent être remplis.' })

    await prisma.$transaction([
      ...myFields
        .filter((f) => valueById.has(f.id))
        .map((f) => prisma.signField.update({ where: { id: f.id }, data: { value: valueById.get(f.id) } })),
      prisma.signRecipient.update({
        where: { id: r.id },
        data: {
          status: 'SIGNED',
          signedAt: new Date(),
          ip: request.ip ?? null,
          userAgent: (request.headers['user-agent'] as string | undefined)?.slice(0, 255) ?? null,
          accessTokenHash: null, // jeton à usage unique : consommé
        },
      }),
    ])
    await recordEvent(r.envelopeId, 'signed', { actorLabel: r.name, recipientId: r.id, request })

    // État du workflow après cette signature.
    const after = await prisma.signRecipient.findMany({ where: { envelopeId: r.envelopeId } })
    const remaining = after.filter((x) => isActingRecipient(x) && x.status !== 'SIGNED' && x.status !== 'DECLINED')

    if (remaining.length === 0) {
      await prisma.signEnvelope.update({ where: { id: r.envelopeId }, data: { status: 'COMPLETED', completedAt: new Date() } })
      await recordEvent(r.envelopeId, 'completed', { actorLabel: 'system' })
      // Compose + scelle le PDF final (best-effort : n'échoue jamais la signature).
      try { await finalizeEnvelope(r.envelopeId) } catch (err) { console.error('finalizeEnvelope failed', err) }
      const owner = await prisma.user.findUnique({ where: { id: r.envelope.ownerId }, select: { id: true, email: true, name: true } })
      if (owner) {
        await notify({ userId: owner.id, type: 'SIGN_COMPLETED', title: 'Document signé', body: `« ${r.envelope.name} » est entièrement signé.`, link: `/signdoc/${r.envelopeId}` })
        await sendSignatureCompletedEmail(owner.email, owner.name, r.envelope.name, `${FRONTEND_URL}/signdoc/${r.envelopeId}`)
      }
    } else {
      if (r.envelope.status === 'SENT') await prisma.signEnvelope.update({ where: { id: r.envelopeId }, data: { status: 'IN_PROGRESS' } })
      if (activeOrder(after) !== null) await dispatchActiveStep(r.envelopeId) // notifie l'étape suivante (séquentiel)
    }

    return { ok: true, completed: remaining.length === 0 }
  })

  // Refus de signer : marque DECLINED, l'enveloppe passe DECLINED, prévient le propriétaire.
  app.post('/:token/decline', RL, async (request, reply) => {
    const { token } = request.params as { token: string }
    const r = await resolveByToken(token)
    if (!r) return reply.status(404).send({ error: 'Lien invalide ou expiré.' })
    if (!ENVELOPE_ACTIVE.has(r.envelope.status)) return reply.status(409).send({ error: 'Cette demande n’est plus active.' })
    const { reason } = z.object({ reason: z.string().max(500).optional() }).parse(request.body ?? {})

    await prisma.signRecipient.update({ where: { id: r.id }, data: { status: 'DECLINED', declinedAt: new Date(), declineReason: reason ?? null, accessTokenHash: null } })
    await prisma.signEnvelope.update({ where: { id: r.envelopeId }, data: { status: 'DECLINED' } })
    await recordEvent(r.envelopeId, 'declined', { actorLabel: r.name, recipientId: r.id, request, payload: reason ? { reason } : undefined })

    const owner = await prisma.user.findUnique({ where: { id: r.envelope.ownerId }, select: { id: true } })
    if (owner) await notify({ userId: owner.id, type: 'SIGN_DECLINED', title: 'Signature refusée', body: `${r.name} a refusé de signer « ${r.envelope.name} ».`, link: `/signdoc/${r.envelopeId}` })

    return { ok: true }
  })
}
