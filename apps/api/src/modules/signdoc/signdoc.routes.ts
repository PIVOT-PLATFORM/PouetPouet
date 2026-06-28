import type { FastifyPluginAsync } from 'fastify'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { PDFDocument } from 'pdf-lib'
import { prisma } from '../../lib/prisma.js'
import { audit } from '../../lib/audit.js'
import { resolveRole, sharedResourceIds, deleteResourceShares, type ModuleRole } from '../../lib/module-share.js'
import { recordEvent, verifyChain } from './signdoc.events.js'
import { dispatchActiveStep, isActingRecipient } from './signdoc.workflow.js'
import { notify } from '../../lib/notify.js'
import { deleteEnvelopeFiles, originalStream, readSealed, sealedExists, sealedStream, sha256, writeOriginal } from './signdoc.storage.js'

// SignDoc — gestion de documents signés (type DocuSign), auto-hébergé. PR1 couvre
// l'« atelier d'enveloppe » : création depuis un PDF (upload ou import PDF Manager),
// gestion des signataires (ordre + échéances), designer de champs, vue workflow.
// L'envoi, la signature et le sceau cryptographique arrivent dans les PR suivantes.
// Autorisation via ModuleShare (module='signdoc') : OWNER/EDITOR éditent en DRAFT,
// VIEWER lit, seul le propriétaire supprime et gère les partages.

const FILE_LIMIT = 100 * 1024 * 1024 // 100 Mo, comme le module PDF
const PDF_UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? './uploads/pdfs') // source des imports PDF Manager

const ISO = z.string().datetime({ offset: true })

const recipientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  routingOrder: z.number().int().min(1).max(99).optional(),
  role: z.enum(['SIGNER', 'APPROVER', 'CC']).optional(),
  deadline: ISO.nullable().optional(),
})

const envelopePatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  message: z.string().max(5000).nullable().optional(),
  ordered: z.boolean().optional(),
  globalDeadline: ISO.nullable().optional(),
})

const fieldsSchema = z.object({
  fields: z
    .array(
      z.object({
        recipientId: z.string().min(1),
        page: z.number().int().min(0),
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0).max(1),
        h: z.number().min(0).max(1),
        type: z.enum(['SIGNATURE', 'INITIALS', 'DATE', 'TEXT']).optional(),
        required: z.boolean().optional(),
      }),
    )
    .max(200),
})

const ENVELOPE_DETAIL = {
  recipients: { orderBy: [{ routingOrder: 'asc' as const }, { createdAt: 'asc' as const }] },
  fields: true,
  events: { orderBy: { createdAt: 'asc' as const } },
}

async function countPages(bytes: Buffer): Promise<number | null> {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    return doc.getPageCount()
  } catch {
    return null
  }
}

export const signdocRoutes: FastifyPluginAsync = async (app) => {
  await app.register(import('@fastify/multipart'), { limits: { fileSize: FILE_LIMIT } })
  app.addHook('preHandler', app.authenticate)

  // Rôle effectif sur une enveloppe (OWNER/EDITOR/VIEWER) ou null si pas d'accès.
  async function roleFor(envelopeId: string, userId: string): Promise<{ role: ModuleRole | null; ownerId: string | null; status: string | null }> {
    const env = await prisma.signEnvelope.findUnique({ where: { id: envelopeId }, select: { ownerId: true, status: true } })
    if (!env) return { role: null, ownerId: null, status: null }
    const role = await resolveRole('signdoc', envelopeId, userId, env.ownerId)
    return { role, ownerId: env.ownerId, status: env.status }
  }

  // Garde d'édition : exige OWNER/EDITOR + enveloppe encore en DRAFT.
  // Renvoie un code d'erreur (404 inconnu/étranger, 403 lecture seule, 409 figée) ou null si OK.
  function editGuard(role: ModuleRole | null, status: string | null): { code: number; error: string } | null {
    if (!role) return { code: 404, error: 'Enveloppe introuvable.' }
    if (role === 'VIEWER') return { code: 403, error: 'Accès en lecture seule.' }
    if (status !== 'DRAFT') return { code: 409, error: "L'enveloppe n'est plus modifiable (déjà envoyée)." }
    return null
  }

  // ── Enveloppes ────────────────────────────────────────────────────────────────

  // Liste : enveloppes possédées + partagées, annotées de leur rôle.
  app.get('/', async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('signdoc', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const envelopes = await prisma.signEnvelope.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      include: { _count: { select: { recipients: true, fields: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return envelopes.map((e) => ({
      id: e.id,
      name: e.name,
      ownerId: e.ownerId,
      status: e.status,
      ordered: e.ordered,
      pageCount: e.pageCount,
      globalDeadline: e.globalDeadline,
      recipientCount: e._count.recipients,
      fieldCount: e._count.fields,
      role: e.ownerId === userId ? 'OWNER' : (sharedRole.get(e.id) ?? 'VIEWER'),
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }))
  })

  // Détail : enveloppe + signataires + champs + timeline. Lecture pour tout rôle.
  app.get('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const envelope = await prisma.signEnvelope.findUnique({ where: { id }, include: ENVELOPE_DETAIL })
    if (!envelope) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    const role = await resolveRole('signdoc', id, userId, envelope.ownerId)
    if (!role) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    return { ...envelope, role }
  })

  // Stream du PDF figé (preview du designer). Lecture pour tout rôle.
  app.get('/:id/file', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const env = await prisma.signEnvelope.findUnique({ where: { id }, select: { ownerId: true, name: true } })
    if (!env) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    const role = await resolveRole('signdoc', id, userId, env.ownerId)
    if (!role) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(env.name)}.pdf`)
    return reply.send(originalStream(id))
  })

  // Création depuis un upload PDF (multipart).
  app.post('/upload', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Fichier manquant.' })
    if (!data.filename.toLowerCase().endsWith('.pdf') && data.mimetype !== 'application/pdf') {
      return reply.status(400).send({ error: 'Seuls les fichiers PDF sont acceptés.' })
    }
    const bytes = await data.toBuffer()
    const pageCount = await countPages(bytes)
    if (pageCount === null) return reply.status(422).send({ error: 'Impossible de lire le PDF (corrompu ou chiffré).' })
    const cleanName = data.filename.replace(/\.pdf$/i, '').trim() || 'Document'
    const created = await createEnvelope(ownerId, cleanName, bytes, pageCount, request)
    return reply.status(201).send(created)
  })

  // Création par import d'un document existant du PDF Manager (copie figée des octets).
  app.post('/from-pdf', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { pdfDocumentId, name } = z
      .object({ pdfDocumentId: z.string().min(1), name: z.string().min(1).max(200).optional() })
      .parse(request.body)
    const doc = await prisma.pdfDocument.findFirst({ where: { id: pdfDocumentId, ownerId }, select: { id: true, name: true } })
    if (!doc) return reply.status(404).send({ error: 'PDF introuvable.' })
    const srcPath = path.join(PDF_UPLOAD_DIR, `${doc.id}.pdf`)
    if (!existsSync(srcPath)) return reply.status(404).send({ error: 'Fichier source manquant.' })
    const bytes = readFileSync(srcPath)
    const pageCount = await countPages(bytes)
    if (pageCount === null) return reply.status(422).send({ error: 'Impossible de lire le PDF.' })
    const created = await createEnvelope(ownerId, name?.trim() || doc.name, bytes, pageCount, request)
    return reply.status(201).send(created)
  })

  // Fabrique commune : crée l'enregistrement, fige le fichier, initialise la chaîne.
  async function createEnvelope(ownerId: string, name: string, bytes: Buffer, pageCount: number, request: import('fastify').FastifyRequest) {
    const { name: ownerName } = (await prisma.user.findUnique({ where: { id: ownerId }, select: { name: true } })) ?? { name: 'inconnu' }
    const envelope = await prisma.signEnvelope.create({
      data: { ownerId, name, originalHash: sha256(bytes), pageCount },
    })
    writeOriginal(envelope.id, bytes)
    await recordEvent(envelope.id, 'created', { actorLabel: ownerName, payload: { name, pageCount, originalHash: envelope.originalHash } })
    audit(ownerId, 'signdoc.envelope.created', request, `signdoc:${envelope.id}`)
    const full = await prisma.signEnvelope.findUnique({ where: { id: envelope.id }, include: ENVELOPE_DETAIL })
    return { ...full, role: 'OWNER' as const }
  }

  // Métadonnées : nom, message, ordre, échéance globale (DRAFT, OWNER/EDITOR).
  app.patch('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role, status } = await roleFor(id, userId)
    const denied = editGuard(role, status)
    if (denied) return reply.status(denied.code).send({ error: denied.error })
    const body = envelopePatchSchema.parse(request.body)
    const updated = await prisma.signEnvelope.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.message !== undefined && { message: body.message?.trim() || null }),
        ...(body.ordered !== undefined && { ordered: body.ordered }),
        ...(body.globalDeadline !== undefined && { globalDeadline: body.globalDeadline ? new Date(body.globalDeadline) : null }),
      },
      include: ENVELOPE_DETAIL,
    })
    return { ...updated, role }
  })

  // Suppression — propriétaire uniquement (+ nettoyage partages + fichiers).
  app.delete('/:id', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const env = await prisma.signEnvelope.findFirst({ where: { id, ownerId }, select: { id: true } })
    if (!env) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    await prisma.signEnvelope.delete({ where: { id } })
    await deleteResourceShares('signdoc', id)
    deleteEnvelopeFiles(id)
    audit(ownerId, 'signdoc.envelope.deleted', request, `signdoc:${id}`)
    return reply.status(204).send()
  })

  // ── Signataires ─────────────────────────────────────────────────────────────

  app.post('/:id/recipients', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role, status } = await roleFor(id, userId)
    const denied = editGuard(role, status)
    if (denied) return reply.status(denied.code).send({ error: denied.error })
    const body = recipientSchema.parse(request.body)
    // Lie au compte interne si l'email correspond à un utilisateur connu (sinon externe).
    const account = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() }, select: { id: true } })
    const recipient = await prisma.signRecipient.create({
      data: {
        envelopeId: id,
        userId: account?.id ?? null,
        email: body.email.toLowerCase(),
        name: body.name.trim(),
        routingOrder: body.routingOrder ?? 1,
        role: body.role ?? 'SIGNER',
        deadline: body.deadline ? new Date(body.deadline) : null,
      },
    })
    await prisma.signEnvelope.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.status(201).send(recipient)
  })

  app.patch('/:id/recipients/:rid', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, rid } = request.params as { id: string; rid: string }
    const { role, status } = await roleFor(id, userId)
    const denied = editGuard(role, status)
    if (denied) return reply.status(denied.code).send({ error: denied.error })
    const existing = await prisma.signRecipient.findFirst({ where: { id: rid, envelopeId: id } })
    if (!existing) return reply.status(404).send({ error: 'Signataire introuvable.' })
    const body = recipientSchema.partial().parse(request.body)
    const account = body.email ? await prisma.user.findUnique({ where: { email: body.email.toLowerCase() }, select: { id: true } }) : null
    const recipient = await prisma.signRecipient.update({
      where: { id: rid },
      data: {
        ...(body.email !== undefined && { email: body.email.toLowerCase(), userId: account?.id ?? null }),
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.routingOrder !== undefined && { routingOrder: body.routingOrder }),
        ...(body.role !== undefined && { role: body.role }),
        ...(body.deadline !== undefined && { deadline: body.deadline ? new Date(body.deadline) : null }),
      },
    })
    await prisma.signEnvelope.update({ where: { id }, data: { updatedAt: new Date() } })
    return recipient
  })

  app.delete('/:id/recipients/:rid', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, rid } = request.params as { id: string; rid: string }
    const { role, status } = await roleFor(id, userId)
    const denied = editGuard(role, status)
    if (denied) return reply.status(denied.code).send({ error: denied.error })
    const existing = await prisma.signRecipient.findFirst({ where: { id: rid, envelopeId: id } })
    if (!existing) return reply.status(404).send({ error: 'Signataire introuvable.' })
    // Les champs liés tombent en cascade (FK onDelete: Cascade).
    await prisma.signRecipient.delete({ where: { id: rid } })
    await prisma.signEnvelope.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.status(204).send()
  })

  // ── Champs (designer) ─────────────────────────────────────────────────────────

  // Remplace l'ensemble des champs placés. Coordonnées en fractions 0..1 de la page.
  app.put('/:id/fields', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role, status } = await roleFor(id, userId)
    const denied = editGuard(role, status)
    if (denied) return reply.status(denied.code).send({ error: denied.error })
    const { fields } = fieldsSchema.parse(request.body)
    const env = await prisma.signEnvelope.findUnique({ where: { id }, select: { pageCount: true } })
    if (!env) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    // Tous les champs doivent viser un signataire de cette enveloppe et une page valide.
    const recipientIds = new Set((await prisma.signRecipient.findMany({ where: { envelopeId: id }, select: { id: true } })).map((r) => r.id))
    for (const f of fields) {
      if (!recipientIds.has(f.recipientId)) return reply.status(400).send({ error: 'Signataire inconnu pour un champ.' })
      if (f.page >= env.pageCount) return reply.status(400).send({ error: 'Page hors document pour un champ.' })
    }
    await prisma.$transaction([
      prisma.signField.deleteMany({ where: { envelopeId: id } }),
      prisma.signField.createMany({
        data: fields.map((f) => ({
          envelopeId: id,
          recipientId: f.recipientId,
          page: f.page,
          x: f.x,
          y: f.y,
          w: f.w,
          h: f.h,
          type: f.type ?? 'SIGNATURE',
          required: f.required ?? true,
        })),
      }),
      prisma.signEnvelope.update({ where: { id }, data: { updatedAt: new Date() } }),
    ])
    return prisma.signField.findMany({ where: { envelopeId: id } })
  })

  // ── Envoi / annulation ──────────────────────────────────────────────────────

  // Envoie l'enveloppe : fige le workflow, génère les liens, notifie l'étape active.
  app.post('/:id/send', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role, status } = await roleFor(id, userId)
    const denied = editGuard(role, status)
    if (denied) return reply.status(denied.code).send({ error: denied.error })

    const recipients = await prisma.signRecipient.findMany({ where: { envelopeId: id } })
    const actors = recipients.filter(isActingRecipient)
    if (actors.length === 0) return reply.status(400).send({ error: 'Ajoutez au moins un signataire.' })
    const fields = await prisma.signField.findMany({ where: { envelopeId: id }, select: { recipientId: true } })
    const withFields = new Set(fields.map((f) => f.recipientId))
    const missing = actors.filter((r) => !withFields.has(r.id))
    if (missing.length > 0) return reply.status(400).send({ error: `Chaque signataire doit avoir au moins un champ : ${missing.map((m) => m.name).join(', ')}.` })

    const { name: ownerName } = (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })) ?? { name: 'inconnu' }
    await prisma.signEnvelope.update({ where: { id }, data: { status: 'SENT' } })
    await recordEvent(id, 'sent', { actorLabel: ownerName, request, payload: { recipients: actors.length } })
    await dispatchActiveStep(id)

    const full = await prisma.signEnvelope.findUnique({ where: { id }, include: ENVELOPE_DETAIL })
    return { ...full, role }
  })

  // Annule une enveloppe en cours (propriétaire). Invalide les liens d'accès.
  app.post('/:id/void', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const env = await prisma.signEnvelope.findFirst({ where: { id, ownerId: userId }, select: { id: true, status: true, name: true } })
    if (!env) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    if (env.status !== 'SENT' && env.status !== 'IN_PROGRESS') return reply.status(409).send({ error: 'Seule une enveloppe en cours peut être annulée.' })
    const { reason } = z.object({ reason: z.string().max(500).optional() }).parse(request.body ?? {})

    await prisma.signEnvelope.update({ where: { id }, data: { status: 'VOIDED', voidedAt: new Date(), voidReason: reason ?? null } })
    // Invalide les jetons d'accès en attente.
    await prisma.signRecipient.updateMany({ where: { envelopeId: id, status: { in: ['PENDING', 'SENT', 'VIEWED'] } }, data: { accessTokenHash: null, tokenExpires: null } })
    await recordEvent(id, 'voided', { actorLabel: env.name, request, payload: reason ? { reason } : undefined })
    // Prévient les signataires internes encore actifs.
    const internals = await prisma.signRecipient.findMany({ where: { envelopeId: id, userId: { not: null } }, select: { userId: true } })
    await Promise.all(internals.map((r) => notify({ userId: r.userId as string, type: 'SIGN_DECLINED', title: 'Demande de signature annulée', body: `« ${env.name} » a été annulée.` })))

    const full = await prisma.signEnvelope.findUnique({ where: { id }, include: ENVELOPE_DETAIL })
    return { ...full, role: 'OWNER' as const }
  })

  // ── Téléchargements & preuve ──────────────────────────────────────────────────

  // PDF scellé (signatures + certificat). 404 tant que l'enveloppe n'est pas finalisée.
  app.get('/:id/sealed', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const env = await prisma.signEnvelope.findUnique({ where: { id }, select: { ownerId: true, name: true } })
    if (!env) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    if (!(await resolveRole('signdoc', id, userId, env.ownerId))) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    if (!sealedExists(id)) return reply.status(404).send({ error: 'Document scellé indisponible.' })
    reply.header('Content-Type', 'application/pdf')
    reply.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(env.name)}-signe.pdf`)
    return reply.send(sealedStream(id))
  })

  // Journal de preuve (chaîne d'événements).
  app.get('/:id/audit', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const env = await prisma.signEnvelope.findUnique({ where: { id }, select: { ownerId: true } })
    if (!env || !(await resolveRole('signdoc', id, userId, env.ownerId))) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    return prisma.signEvent.findMany({
      where: { envelopeId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, actorLabel: true, ip: true, createdAt: true, hash: true, prevHash: true },
    })
  })

  // Vérification d'intégrité : empreinte du fichier scellé + chaîne d'événements.
  app.get('/:id/verify', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const env = await prisma.signEnvelope.findUnique({ where: { id }, select: { ownerId: true, status: true, originalHash: true, sealedHash: true, sealLevel: true, completedAt: true } })
    if (!env || !(await resolveRole('signdoc', id, userId, env.ownerId))) return reply.status(404).send({ error: 'Enveloppe introuvable.' })
    const chainValid = await verifyChain(id)
    const fileIntegrity = env.sealedHash && sealedExists(id) ? sha256(readSealed(id)) === env.sealedHash : null
    return {
      status: env.status,
      originalHash: env.originalHash,
      sealedHash: env.sealedHash,
      sealLevel: env.sealLevel,
      completedAt: env.completedAt,
      chainValid,
      fileIntegrity, // null tant que non scellé ; true/false sinon
    }
  })
}
