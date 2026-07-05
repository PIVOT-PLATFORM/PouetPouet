import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import crypto from 'node:crypto'
import path from 'node:path'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, deleteResourceShares } from '../../lib/module-share.js'
import { sendFormResponseEmail, sendFormInviteEmail, sendFormReminderEmail } from '../../lib/mailer.js'
import { saveFile, readFile, deleteStorageFile } from '../../lib/storage.js'
import { bus } from '../../lib/bus.js'
import type { FormFieldDef, FormFileValue } from '@pouetpouet/shared'
import { closedReason, validateAnswer, isFileValue } from './forms-validate.js'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

// Module Formulaires — formulaires autonomes type Google Forms.
// Partage par rôle via ModuleShare (module = 'form'). Remplissage public
// anonyme via publicToken (routes /public/* sans authentification).

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(300),
  description: z.string().max(1000).optional(),
  type: z.enum(['short_text', 'long_text', 'number', 'date', 'email', 'dropdown', 'radio', 'checkboxes', 'scale', 'file', 'grid', 'section']),
  required: z.boolean(),
  options: z.array(z.string().max(300)).max(50).optional(),
  allowOther: z.boolean().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().positive().optional(),
  pattern: z.string().max(500).optional(),
  scaleMin: z.number().int().optional(),
  scaleMax: z.number().int().optional(),
  scaleMinLabel: z.string().max(100).optional(),
  scaleMaxLabel: z.string().max(100).optional(),
  gridRows: z.array(z.string().max(300)).max(30).optional(),
  gridCols: z.array(z.string().max(300)).max(30).optional(),
  gridMultiple: z.boolean().optional(),
  optionRouting: z.record(z.string()).optional(),
})

const formCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  fields: z.array(fieldSchema).max(100).optional(),
})

const formUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  fields: z.array(fieldSchema).max(100).optional(),
  isPublished: z.boolean().optional(),
  acceptingResponses: z.boolean().optional(),
  limitOneResponse: z.boolean().optional(),
  notifyOnResponse: z.boolean().optional(),
  confirmationMessage: z.string().max(2000).nullable().optional(),
  redirectUrl: z.string().max(2000).nullable().optional(),
  closesAt: z.string().datetime().nullable().optional(),
  maxResponses: z.number().int().positive().nullable().optional(),
  remindersEnabled: z.boolean().optional(),
  reminderFrequencyDays: z.number().int().min(1).max(30).optional(),
})

function asFields(json: unknown): FormFieldDef[] {
  return Array.isArray(json) ? (json as FormFieldDef[]) : []
}

type FormRow = {
  id: string; ownerId: string; title: string; description: string | null
  isPublished: boolean; acceptingResponses: boolean; limitOneResponse: boolean
  notifyOnResponse: boolean; confirmationMessage: string | null; redirectUrl: string | null
  closesAt: Date | null; maxResponses: number | null
  publicToken: string; remindersEnabled: boolean; reminderFrequencyDays: number
  fields: unknown; createdAt: Date; updatedAt: Date
}

// Mappe une ligne Form vers la réponse détail (sans fieldCount, avec fields).
function toDetail(f: FormRow, role: string, responseCount: number) {
  return {
    id: f.id, ownerId: f.ownerId, title: f.title, description: f.description,
    isPublished: f.isPublished, acceptingResponses: f.acceptingResponses,
    limitOneResponse: f.limitOneResponse, notifyOnResponse: f.notifyOnResponse,
    confirmationMessage: f.confirmationMessage, redirectUrl: f.redirectUrl,
    closesAt: f.closesAt, maxResponses: f.maxResponses,
    publicToken: f.publicToken, remindersEnabled: f.remindersEnabled, reminderFrequencyDays: f.reminderFrequencyDays,
    fields: asFields(f.fields), responseCount, role,
    createdAt: f.createdAt, updatedAt: f.updatedAt,
  }
}

export const formsRoutes: FastifyPluginAsync = async (app) => {
  // ── Routes publiques (sans auth) : remplissage par lien ──────────────────────

  // owner.email n'est jamais renvoyé dans la réponse publique — utilisé uniquement
  // côté serveur pour la notification notifyOnResponse à la soumission.
  const publicFormInclude = { _count: { select: { responses: true } }, owner: { select: { name: true, email: true } } } as const

  // Résout un token public (soit publicToken du formulaire, soit token d'un
  // destinataire nommé) vers le formulaire + l'identité du destinataire le cas échéant.
  async function resolvePublicToken(token: string) {
    const form = await prisma.form.findUnique({ where: { publicToken: token }, include: publicFormInclude })
    if (form) return { form, recipient: null as { id: string; name: string } | null }
    const rec = await prisma.formRecipient.findUnique({ where: { token }, include: { form: { include: publicFormInclude } } })
    if (!rec) return { form: null, recipient: null }
    return { form: rec.form, recipient: { id: rec.id, name: rec.name } }
  }

  // Récupérer un formulaire publié pour le remplir.
  app.get('/public/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const { form, recipient } = await resolvePublicToken(token)
    if (!form) return reply.status(404).send({ reason: 'not_found' })
    // Ne pas divulguer l'email du propriétaire à un porteur anonyme du lien (RGPD).
    if (!form.isPublished) return reply.status(404).send({ reason: 'not_published', ownerName: form.owner.name })
    const reason = closedReason(form, form._count.responses)
    let existingData: Record<string, unknown> | null = null
    if (recipient) {
      const existing = await prisma.formResponse.findUnique({ where: { formId_recipientId: { formId: form.id, recipientId: recipient.id } } })
      existingData = existing ? (existing.data as Record<string, unknown>) : null
    }
    return {
      id: form.id,
      title: form.title,
      description: form.description,
      fields: asFields(form.fields),
      acceptingResponses: reason === null,
      closedReason: reason,
      limitOneResponse: form.limitOneResponse,
      confirmationMessage: form.confirmationMessage,
      redirectUrl: form.redirectUrl,
      recipient: recipient ? { name: recipient.name, existingData } : null,
    }
  })

  // Upload d'un fichier joint (anonyme) — buffer reçu côté serveur, stocké, clé renvoyée.
  // bodyLimit 25 Mo ; content-type parser '*' isolé dans un sous-plugin (cf. parcours).
  await app.register(async (pub) => {
    pub.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: 25 * 1024 * 1024 }, (_req, body, done) => done(null, body))
    pub.post('/public/:token/upload', async (request, reply) => {
      const { token } = request.params as { token: string }
      const rawName = request.headers['x-filename'] as string | undefined
      let filename = 'fichier'
      if (rawName) { try { filename = decodeURIComponent(rawName) } catch { filename = rawName } }
      const { form } = await resolvePublicToken(token)
      if (!form || !form.isPublished) return reply.status(404).send({ error: 'Formulaire introuvable' })
      // Même gating que la soumission de réponse : pas d'upload sur un formulaire fermé/expiré/plein.
      if (closedReason(form, form._count.responses)) return reply.status(403).send({ error: 'Ce formulaire n\'accepte plus de réponses' })
      const body = request.body as Buffer
      if (!body || body.length === 0) return reply.status(400).send({ error: 'Fichier vide' })
      const safe = path.basename(filename).replace(/[^\w.\-]/g, '_').slice(0, 120)
      const key = `forms/${form.id}/${crypto.randomUUID()}-${safe}`
      await saveFile(key, body)
      return reply.status(201).send({ key, filename: safe, size: body.length } satisfies FormFileValue)
    })
  })

  // Soumettre une réponse (anonyme, ou d'un destinataire nommé — modifiable dans ce cas).
  app.post('/public/:token/responses', async (request, reply) => {
    const { token } = request.params as { token: string }
    const { data } = z.object({ data: z.record(z.unknown()) }).parse(request.body)

    const { form, recipient } = await resolvePublicToken(token)
    if (!form || !form.isPublished) return reply.status(404).send({ error: 'Formulaire introuvable' })
    const reason = closedReason(form, form._count.responses)
    if (reason) return reply.status(403).send({ error: 'Ce formulaire n\'accepte plus de réponses' })

    // Validation (requis + contraintes par type)
    const fields = asFields(form.fields)
    for (const f of fields) {
      const err = validateAnswer(f, data[f.id])
      if (err) return reply.status(400).send({ error: err })
    }

    let response: { id: string }
    if (recipient) {
      response = await prisma.formResponse.upsert({
        where: { formId_recipientId: { formId: form.id, recipientId: recipient.id } },
        create: { formId: form.id, recipientId: recipient.id, data: data as Prisma.InputJsonValue },
        update: { data: data as Prisma.InputJsonValue },
      })
      await prisma.formRecipient.update({ where: { id: recipient.id }, data: { respondedAt: new Date() } })
    } else {
      response = await prisma.formResponse.create({
        data: { formId: form.id, respondentId: null, data: data as Prisma.InputJsonValue },
      })
    }

    bus.publish({ type: 'form.response.created', module: 'forms', payload: { formId: form.id, responseId: response.id, data } })

    // Notification email au propriétaire (best-effort, ne bloque pas la réponse)
    if (form.notifyOnResponse && form.owner?.email) {
      sendFormResponseEmail(form.owner.email, form.title, `${FRONTEND_URL}/forms/${form.id}/responses`).catch(() => {})
    }

    return reply.status(201).send({ id: response.id })
  })

  // ── Routes authentifiées ──────────────────────────────────────────────────────
  // Encapsulées dans un sous-plugin pour que le hook auth ne s'applique PAS
  // aux routes publiques /public/* définies plus haut.
  await app.register(async (auth) => {
    auth.addHook('preHandler', auth.authenticate)

    async function roleFor(formId: string, userId: string) {
      const f = await prisma.form.findUnique({ where: { id: formId }, select: { ownerId: true } })
      if (!f) return { role: null as null, ownerId: null as null }
      const role = await resolveRole('form', formId, userId, f.ownerId)
      return { role, ownerId: f.ownerId }
    }

  // Liste de mes formulaires (possédés + partagés avec moi).
  // Les deux requêtes sont indépendantes → Promise.all.
  auth.get('/', async (request) => {
    const { id: userId } = request.user as { id: string }

    const [ownedForms, sharedEntries] = await Promise.all([
      prisma.form.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { responses: true } } },
      }),
      prisma.moduleShare.findMany({
        where: { module: 'form', userId },
        select: { resourceId: true, role: true },
      }),
    ])

    const sharedRoles = new Map(sharedEntries.map((s) => [s.resourceId, s.role]))
    let sharedForms: typeof ownedForms = []
    if (sharedEntries.length > 0) {
      sharedForms = await prisma.form.findMany({
        where: { id: { in: sharedEntries.map((s) => s.resourceId) } },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { responses: true } } },
      })
    }

    const allForms = [...ownedForms, ...sharedForms].sort((a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime()
    )
    return allForms.map((f) => ({
      id: f.id,
      ownerId: f.ownerId,
      title: f.title,
      description: f.description,
      isPublished: f.isPublished,
      acceptingResponses: f.acceptingResponses,
      limitOneResponse: f.limitOneResponse,
      notifyOnResponse: f.notifyOnResponse,
      confirmationMessage: f.confirmationMessage,
      redirectUrl: f.redirectUrl,
      closesAt: f.closesAt,
      maxResponses: f.maxResponses,
      publicToken: f.publicToken,
      fieldCount: asFields(f.fields).length,
      responseCount: f._count.responses,
      role: f.ownerId === userId ? 'OWNER' : (sharedRoles.get(f.id) ?? 'VIEWER'),
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }))
  })

  // Créer un formulaire.
  auth.post('/', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const body = formCreateSchema.parse(request.body)
    const form = await prisma.form.create({
      data: {
        ownerId: userId,
        title: body.title.trim(),
        description: body.description ?? null,
        fields: (body.fields ?? []) as Prisma.InputJsonValue,
        publicToken: crypto.randomBytes(9).toString('base64url'),
      },
    })
    return reply.status(201).send(toDetail(form, 'OWNER', 0))
  })

  // Dupliquer un formulaire (n'importe quel rôle ; la copie appartient à l'appelant).
  auth.post('/:id/duplicate', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const src = await prisma.form.findUnique({ where: { id } })
    if (!src) return reply.status(404).send({ error: 'Formulaire introuvable' })
    const role = await resolveRole('form', id, userId, src.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })

    const copy = await prisma.form.create({
      data: {
        ownerId: userId,
        title: `${src.title} (copie)`,
        description: src.description,
        fields: src.fields as Prisma.InputJsonValue,
        confirmationMessage: src.confirmationMessage,
        redirectUrl: src.redirectUrl,
        limitOneResponse: src.limitOneResponse,
        notifyOnResponse: src.notifyOnResponse,
        maxResponses: src.maxResponses,
        // la copie démarre en brouillon, sans date de fermeture ni réponses
        publicToken: crypto.randomBytes(9).toString('base64url'),
      },
    })
    return reply.status(201).send(toDetail(copy, 'OWNER', 0))
  })

  // Détail d'un formulaire.
  auth.get('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const form = await prisma.form.findUnique({ where: { id }, include: { _count: { select: { responses: true } } } })
    if (!form) return reply.status(404).send({ error: 'Formulaire introuvable' })
    const role = await resolveRole('form', id, userId, form.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    return toDetail(form, role, form._count.responses)
  })

  // Mettre à jour un formulaire.
  auth.patch('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    // Parse le body d'abord : fail fast si invalide, sans toucher la DB.
    const body = formUpdateSchema.parse(request.body)
    const { role } = await roleFor(id, userId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })
    const form = await prisma.form.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.fields !== undefined ? { fields: body.fields as Prisma.InputJsonValue } : {}),
        ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
        ...(body.acceptingResponses !== undefined ? { acceptingResponses: body.acceptingResponses } : {}),
        ...(body.limitOneResponse !== undefined ? { limitOneResponse: body.limitOneResponse } : {}),
        ...(body.notifyOnResponse !== undefined ? { notifyOnResponse: body.notifyOnResponse } : {}),
        ...(body.confirmationMessage !== undefined ? { confirmationMessage: body.confirmationMessage } : {}),
        ...(body.redirectUrl !== undefined ? { redirectUrl: body.redirectUrl } : {}),
        ...(body.closesAt !== undefined ? { closesAt: body.closesAt ? new Date(body.closesAt) : null } : {}),
        ...(body.maxResponses !== undefined ? { maxResponses: body.maxResponses } : {}),
        ...(body.remindersEnabled !== undefined ? { remindersEnabled: body.remindersEnabled } : {}),
        ...(body.reminderFrequencyDays !== undefined ? { reminderFrequencyDays: body.reminderFrequencyDays } : {}),
      },
      include: { _count: { select: { responses: true } } },
    })
    return toDetail(form, role, form._count.responses)
  })

  // Supprimer un formulaire.
  auth.delete('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const form = await prisma.form.findUnique({ where: { id }, select: { ownerId: true } })
    if (!form) return reply.status(404).send({ error: 'Formulaire introuvable' })
    if (form.ownerId !== userId) return reply.status(403).send({ error: 'Seul le propriétaire peut supprimer' })
    await prisma.form.delete({ where: { id } })
    await deleteResourceShares('form', id)
    return reply.status(204).send()
  })

  // ── Destinataires nommés (sans compte) : lien personnel + suivi + relances ──

  // Liste des destinataires (avec statut de réponse).
  auth.get('/:id/recipients', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    const recipients = await prisma.formRecipient.findMany({ where: { formId: id }, orderBy: { createdAt: 'asc' } })
    return recipients.map((r) => ({
      id: r.id,
      formId: r.formId,
      name: r.name,
      email: r.email,
      token: r.token,
      invitedAt: r.invitedAt,
      respondedAt: r.respondedAt,
      lastRemindedAt: r.lastRemindedAt,
      remindersSent: r.remindersSent,
    }))
  })

  const addRecipientsSchema = z.object({
    recipients: z.array(z.object({ name: z.string().min(1).max(200), email: z.string().email() })).min(1).max(500),
  })

  // Ajout en lot (collage « Nom <email> » par ligne, parsé côté client). Les
  // emails déjà présents pour ce formulaire sont ignorés silencieusement.
  auth.post('/:id/recipients', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const body = addRecipientsSchema.parse(request.body)
    const { role } = await roleFor(id, userId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    const existing = await prisma.formRecipient.findMany({ where: { formId: id }, select: { email: true } })
    const existingEmails = new Set(existing.map((e) => e.email.toLowerCase()))
    const seen = new Set<string>()
    const toCreate = body.recipients.filter((r) => {
      const email = r.email.trim().toLowerCase()
      if (existingEmails.has(email) || seen.has(email)) return false
      seen.add(email)
      return true
    })
    const created = await prisma.$transaction(
      toCreate.map((r) => prisma.formRecipient.create({
        data: { formId: id, name: r.name.trim(), email: r.email.trim().toLowerCase(), token: crypto.randomBytes(24).toString('base64url') },
      }))
    )
    return reply.status(201).send({ created: created.length, skipped: body.recipients.length - created.length })
  })

  // Supprimer un destinataire (ses réponses restent, détachées).
  auth.delete('/:id/recipients/:rid', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, rid } = request.params as { id: string; rid: string }
    const { role } = await roleFor(id, userId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })
    const rec = await prisma.formRecipient.findUnique({ where: { id: rid }, select: { formId: true } })
    if (!rec || rec.formId !== id) return reply.status(404).send({ error: 'Destinataire introuvable' })
    await prisma.formRecipient.delete({ where: { id: rid } })
    return reply.status(204).send()
  })

  const sendRecipientsSchema = z.object({ recipientIds: z.array(z.string()).optional() })

  // Envoi initial (destinataires ciblés, ou tous les non-invités par défaut).
  auth.post('/:id/recipients/send', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const body = sendRecipientsSchema.parse(request.body ?? {})
    const { role } = await roleFor(id, userId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    const form = await prisma.form.findUnique({ where: { id }, select: { title: true } })
    if (!form) return reply.status(404).send({ error: 'Formulaire introuvable' })

    const where = body.recipientIds?.length
      ? { formId: id, id: { in: body.recipientIds } }
      : { formId: id, invitedAt: null }
    const recipients = await prisma.formRecipient.findMany({ where })

    let sent = 0
    for (const r of recipients) {
      const link = `${FRONTEND_URL}/f/${r.token}`
      await sendFormInviteEmail(r.email, r.name, form.title, link).catch(() => {})
      await prisma.formRecipient.update({ where: { id: r.id }, data: { invitedAt: new Date() } })
      sent++
    }
    return { sent }
  })

  const REMIND_COOLDOWN_MS = 20 * 60 * 60 * 1000 // pas plus d'une relance manuelle toutes les 20 h

  // Relance manuelle d'un destinataire n'ayant pas répondu.
  auth.post('/:id/recipients/:rid/remind', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, rid } = request.params as { id: string; rid: string }
    const { role } = await roleFor(id, userId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    const form = await prisma.form.findUnique({ where: { id }, select: { title: true } })
    if (!form) return reply.status(404).send({ error: 'Formulaire introuvable' })
    const rec = await prisma.formRecipient.findUnique({ where: { id: rid } })
    if (!rec || rec.formId !== id) return reply.status(404).send({ error: 'Destinataire introuvable' })
    if (rec.respondedAt) return reply.status(400).send({ error: 'Ce destinataire a déjà répondu' })
    const last = rec.lastRemindedAt ?? rec.invitedAt
    if (last && Date.now() - last.getTime() < REMIND_COOLDOWN_MS) {
      return reply.status(429).send({ error: 'Une relance a déjà été envoyée récemment' })
    }

    const link = `${FRONTEND_URL}/f/${rec.token}`
    await sendFormReminderEmail(rec.email, rec.name, form.title, link).catch(() => {})
    const updated = await prisma.formRecipient.update({
      where: { id: rid },
      data: { invitedAt: rec.invitedAt ?? new Date(), lastRemindedAt: new Date(), remindersSent: { increment: 1 } },
    })
    return { id: updated.id, lastRemindedAt: updated.lastRemindedAt, remindersSent: updated.remindersSent }
  })

  // Liste des réponses.
  auth.get('/:id/responses', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })

    const responses = await prisma.formResponse.findMany({
      where: { formId: id },
      orderBy: { createdAt: 'desc' },
      include: { recipient: { select: { id: true, name: true, email: true } } },
    })
    return responses.map((r) => ({
      id: r.id,
      formId: r.formId,
      respondentId: r.respondentId,
      recipient: r.recipient ? { id: r.recipient.id, name: r.recipient.name, email: r.recipient.email } : null,
      data: r.data,
      createdAt: r.createdAt,
    }))
  })

  // Export CSV des réponses.
  auth.get('/:id/responses.csv', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const form = await prisma.form.findUnique({ where: { id } })
    if (!form) return reply.status(404).send({ error: 'Formulaire introuvable' })
    const role = await resolveRole('form', id, userId, form.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })

    // Les sections ne sont pas des champs de données → exclues des colonnes.
    const fields = asFields(form.fields).filter((f) => f.type !== 'section')
    const responses = await prisma.formResponse.findMany({
      where: { formId: id },
      orderBy: { createdAt: 'asc' },
      include: { recipient: { select: { name: true, email: true } } },
    })

    const cell = (f: FormFieldDef, v: unknown): string => {
      if (f.type === 'file' && v && typeof v === 'object') return (v as FormFileValue).filename ?? ''
      if (f.type === 'grid' && v && typeof v === 'object' && !Array.isArray(v)) {
        return Object.entries(v as Record<string, unknown>)
          .map(([row, col]) => `${row}: ${Array.isArray(col) ? col.join('/') : String(col)}`)
          .join('; ')
      }
      if (Array.isArray(v)) return v.join('; ')
      return v == null ? '' : String(v)
    }
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const header = ['Date', 'Nom', 'Email', ...fields.map((f) => f.label)]
    const rows = responses.map((r) => {
      const data = (r.data ?? {}) as Record<string, unknown>
      return [r.createdAt.toISOString(), r.recipient?.name ?? '', r.recipient?.email ?? '', ...fields.map((f) => cell(f, data[f.id]))].map(esc).join(',')
    })
    const csv = [header.map(esc).join(','), ...rows].join('\r\n')

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="reponses-${id}.csv"`)
    return reply.send('﻿' + csv) // BOM pour Excel
  })

  // Supprimer une réponse (EDITOR+).
  auth.delete('/:id/responses/:responseId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, responseId } = request.params as { id: string; responseId: string }
    const { role } = await roleFor(id, userId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    const resp = await prisma.formResponse.findUnique({ where: { id: responseId }, select: { formId: true, data: true, recipientId: true } })
    if (!resp || resp.formId !== id) return reply.status(404).send({ error: 'Réponse introuvable' })

    // Nettoyage des fichiers joints éventuels (best-effort).
    const data = (resp.data ?? {}) as Record<string, unknown>
    for (const v of Object.values(data)) {
      if (isFileValue(v)) {
        await deleteStorageFile(v.key).catch(() => {})
      }
    }
    await prisma.formResponse.delete({ where: { id: responseId } })
    // Redevient « en attente » pour ce destinataire (relances possibles à nouveau).
    if (resp.recipientId) {
      await prisma.formRecipient.update({ where: { id: resp.recipientId }, data: { respondedAt: null } }).catch(() => {})
    }
    return reply.status(204).send()
  })

  // Télécharger un fichier joint (OWNER/EDITOR/VIEWER de ce formulaire).
  auth.get('/:id/files/*', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const key = (request.params as { '*': string })['*']
    const { role } = await roleFor(id, userId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    // La clé doit appartenir à ce formulaire.
    if (!key.startsWith(`forms/${id}/`)) return reply.status(403).send({ error: 'Accès refusé' })

    const buf = await readFile(key)
    if (!buf) return reply.status(404).send({ error: 'Fichier introuvable' })
    const filename = key.split('/').pop() ?? 'fichier'
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    return reply.send(buf)
  })
  }) // fin du sous-plugin authentifié
}
