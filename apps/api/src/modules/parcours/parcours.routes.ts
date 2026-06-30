import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares } from '../../lib/module-share.js'
import { notify } from '../../lib/notify.js'
import { sendParcoursStepAssignedEmail } from '../../lib/mailer.js'
import { getUploadSignedUrl, getDownloadSignedUrl, deleteStorageFile, LOCAL_UPLOAD_DIR } from '../../lib/storage.js'

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

// Parcours — workflows structurés : templates définissant une suite d'étapes
// (info, form, document, approval, email), instanciables et suivables via un
// cockpit. Partage par rôle via ModuleShare (module='parcourTemplate' ou
// 'parcourInstance'). OWNER/EDITOR éditent, VIEWER lit, seul le propriétaire
// supprime. Pas de temps réel — tout passe par REST.

const templateCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  steps: z.array(z.record(z.unknown())).min(1).max(50),
  defaultObservers: z.array(z.string()).optional(),
})

const templateUpdateSchema = templateCreateSchema.partial()

const instanceCreateSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1).max(200),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  dueAt: z.string().datetime().optional(),
})

const stepCompleteSchema = z.object({
  action: z.enum(['complete', 'reject']),
  data: z.record(z.unknown()).optional(),
  comment: z.string().max(2000).optional(),
})

const documentRegisterSchema = z.object({
  storageKey: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  sizeBytes: z.number().int().positive(),
  classification: z.enum(['C0', 'C1', 'C2', 'C3']).optional(),
  stepIndex: z.number().int().min(0).optional(),
})

type ModuleStepDef = {
  type?: string
  assignedTo?: string
  moduleAction?: 'create_board' | 'create_meeting' | 'create_daily' | 'create_scrum'
  moduleParams?: { title?: string }
}

// Crée la ressource dans le module cible et retourne les métadonnées à stocker dans stepInstance.data.
async function triggerModuleAction(
  step: ModuleStepDef,
  ownerId: string,
  instanceTitle: string,
): Promise<Record<string, unknown> | null> {
  if (step.type !== 'module' || !step.moduleAction) return null
  const title = step.moduleParams?.title ?? instanceTitle

  switch (step.moduleAction) {
    case 'create_board': {
      const board = await prisma.board.create({ data: { name: title, ownerId }, select: { id: true, name: true } })
      return { type: 'board', id: board.id, title: board.name, url: `/boards/${board.id}` }
    }
    case 'create_meeting': {
      const event = await prisma.meetEvent.create({ data: { name: title, ownerId }, select: { id: true, name: true } })
      return { type: 'meeting', id: event.id, title: event.name, url: `/meetops/${event.id}` }
    }
    case 'create_daily': {
      const session = await prisma.dailySession.create({ data: { name: title, ownerId }, select: { id: true, name: true } })
      return { type: 'daily', id: session.id, title: session.name, url: `/daily/${session.id}` }
    }
    case 'create_scrum': {
      let code = Math.random().toString(36).substring(2, 8).toUpperCase()
      let attempts = 0
      while (await prisma.scrumRoom.findUnique({ where: { code } })) {
        code = Math.random().toString(36).substring(2, 8).toUpperCase()
        if (++attempts > 10) return null
      }
      const room = await prisma.scrumRoom.create({ data: { name: title, code, ownerId }, select: { id: true, name: true, code: true } })
      return { type: 'scrum', id: room.id, title: room.name, code: room.code, url: `/scrum/${room.id}` }
    }
    default:
      return null
  }
}

export const parcoursRoutes: FastifyPluginAsync = async (app) => {
  // ── Dev-only file storage ──
  // En Fastify v5, les content-types non enregistrés retournent 415 avant même
  // d'atteindre le handler. On isole les routes _dev dans un sous-plugin pour y
  // enregistrer un parser '*' (buffer) sans impacter les routes JSON parentes.
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && process.env.NODE_ENV !== 'production') {
    await app.register(async (devApp) => {
      devApp.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

      // bodyLimit relevé à 25 Mo : la limite Fastify par défaut (1 Mo) rejetait
      // les images/PDF un peu lourds en dev (en prod l'upload va direct sur GCS).
      devApp.put('/_dev/*', { bodyLimit: 25 * 1024 * 1024 }, async (request, reply) => {
        const key = decodeURIComponent((request.params as { '*': string })['*'])
        const dest = path.join(LOCAL_UPLOAD_DIR, key)
        await fs.mkdir(path.dirname(dest), { recursive: true })
        const body = request.body as Buffer
        if (!body || body.length === 0) return reply.status(400).send({ error: 'Corps vide' })
        await fs.writeFile(dest, body)
        return reply.status(200).send()
      })

      devApp.get('/_dev/*', async (request, reply) => {
        const key = decodeURIComponent((request.params as { '*': string })['*'])
        const filePath = path.join(LOCAL_UPLOAD_DIR, key)
        try {
          const data = await fs.readFile(filePath)
          return reply.send(data)
        } catch {
          return reply.status(404).send({ error: 'Fichier introuvable' })
        }
      })
    })
  }

  app.addHook('preHandler', app.authenticate)

  // ── Helpers ────────────────────────────────────────────────────────────────────

  async function templateRoleFor(templateId: string, userId: string) {
    const t = await prisma.parcourTemplate.findUnique({ where: { id: templateId }, select: { ownerId: true } })
    if (!t) return { role: null as null, ownerId: null as null }
    const role = await resolveRole('parcourTemplate', templateId, userId, t.ownerId)
    return { role, ownerId: t.ownerId }
  }

  async function instanceRoleFor(instanceId: string, userId: string) {
    const i = await prisma.parcourInstance.findUnique({ where: { id: instanceId }, select: { ownerId: true } })
    if (!i) return { role: null as null, ownerId: null as null }
    const role = await resolveRole('parcourInstance', instanceId, userId, i.ownerId)
    return { role, ownerId: i.ownerId }
  }

  async function generateRefNumber(category: string | null): Promise<string> {
    const cat = (category ?? 'PAR').toUpperCase().slice(0, 10)
    const year = new Date().getFullYear()
    const seq = await prisma.parcourSeq.upsert({
      where: { category: cat },
      update: { lastSeq: { increment: 1 } },
      create: { category: cat, lastSeq: 1 },
      select: { lastSeq: true },
    })
    return `${cat}-${year}-${String(seq.lastSeq).padStart(3, '0')}`
  }

  // ── Templates ──────────────────────────────────────────────────────────────────

  // Liste : templates possédés + partagés, annotés du rôle + nb d'étapes.
  app.get('/templates', async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('parcourTemplate', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const templates = await prisma.parcourTemplate.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      orderBy: { updatedAt: 'desc' },
    })
    return templates.map((t) => ({
      id: t.id,
      ownerId: t.ownerId,
      name: t.name,
      description: t.description,
      category: t.category,
      tags: t.tags,
      isPublic: t.isPublic,
      starCount: t.starCount,
      stepCount: Array.isArray(t.steps) ? (t.steps as unknown[]).length : 0,
      role: t.ownerId === userId ? 'OWNER' : (sharedRole.get(t.id) ?? 'VIEWER'),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
  })

  // Détail d'un template.
  app.get('/templates/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const t = await prisma.parcourTemplate.findUnique({ where: { id } })
    if (!t) return reply.status(404).send({ error: 'Template introuvable' })
    const role = await resolveRole('parcourTemplate', id, userId, t.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    return {
      ...t,
      stepCount: Array.isArray(t.steps) ? (t.steps as unknown[]).length : 0,
      role,
    }
  })

  // Création d'un template.
  app.post('/templates', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = templateCreateSchema.parse(request.body)
    const t = await prisma.parcourTemplate.create({
      data: {
        ownerId,
        name: body.name.trim(),
        description: body.description?.trim() ?? null,
        category: body.category?.trim() ?? null,
        tags: body.tags ?? [],
        steps: body.steps as Prisma.InputJsonValue,
        defaultObservers: body.defaultObservers ?? [],
      },
    })
    return reply.status(201).send({ ...t, stepCount: (body.steps).length, role: 'OWNER' })
  })

  // Mise à jour d'un template — OWNER/EDITOR.
  app.patch('/templates/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await templateRoleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Template introuvable' })
    const body = templateUpdateSchema.parse(request.body)
    const updated = await prisma.parcourTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() ?? null }),
        ...(body.category !== undefined && { category: body.category?.trim() ?? null }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.steps !== undefined && { steps: body.steps as Prisma.InputJsonValue }),
        ...(body.defaultObservers !== undefined && { defaultObservers: body.defaultObservers }),
      },
    })
    return { ...updated, stepCount: Array.isArray(updated.steps) ? (updated.steps as unknown[]).length : 0, role }
  })

  // Duplication d'un template — tout rôle autorisé (le dupliqué appartient à l'appelant).
  app.post('/templates/:id/duplicate', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await templateRoleFor(id, userId)
    if (!role) return reply.status(404).send({ error: 'Template introuvable' })
    const source = await prisma.parcourTemplate.findUnique({ where: { id } })
    if (!source) return reply.status(404).send({ error: 'Template introuvable' })
    const copy = await prisma.parcourTemplate.create({
      data: {
        ownerId: userId,
        name: `${source.name} (copie)`,
        description: source.description,
        category: source.category,
        tags: source.tags,
        steps: source.steps as Prisma.InputJsonValue,
        defaultObservers: [],
      },
    })
    const stepCount = Array.isArray(copy.steps) ? (copy.steps as unknown[]).length : 0
    return reply.status(201).send({ ...copy, stepCount, role: 'OWNER' })
  })

  // Suppression d'un template — propriétaire uniquement.
  app.delete('/templates/:id', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const t = await prisma.parcourTemplate.findFirst({ where: { id, ownerId } })
    if (!t) return reply.status(404).send({ error: 'Template introuvable' })
    await prisma.parcourTemplate.delete({ where: { id } })
    await deleteResourceShares('parcourTemplate', id)
    return reply.status(204).send()
  })

  // ── Instances ──────────────────────────────────────────────────────────────────

  // Liste des instances : possédées + partagées.
  app.get('/instances', async (request) => {
    const { id: userId } = request.user as { id: string }
    const { status } = request.query as { status?: string }
    const shared = await sharedResourceIds('parcourInstance', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const instances = await prisma.parcourInstance.findMany({
      where: {
        OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }],
        ...(status && { status: status as never }),
      },
      include: { template: { select: { steps: true, category: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return instances.map((i) => ({
      id: i.id,
      templateId: i.templateId,
      ownerId: i.ownerId,
      title: i.title,
      refNumber: i.refNumber,
      status: i.status,
      priority: i.priority,
      currentStep: i.currentStep,
      stepCount: Array.isArray(i.template.steps) ? (i.template.steps as unknown[]).length : 0,
      category: i.template.category,
      dueAt: i.dueAt,
      remindByEmail: i.remindByEmail,
      role: i.ownerId === userId ? 'OWNER' : (sharedRole.get(i.id) ?? 'VIEWER'),
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    }))
  })

  // Détail d'une instance : steps, documents, historique.
  app.get('/instances/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const instance = await prisma.parcourInstance.findUnique({
      where: { id },
      include: {
        template: { select: { steps: true, category: true } },
        steps: { orderBy: { stepIndex: 'asc' } },
        documents: { orderBy: { createdAt: 'asc' } },
        history: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!instance) return reply.status(404).send({ error: 'Instance introuvable' })
    const role = await resolveRole('parcourInstance', id, userId, instance.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })

    // Auto-réparation : si currentStep pointe sur une étape déjà terminée
    // (COMPLETED/SKIPPED, héritage d'anciennes validations dans le désordre),
    // on le repositionne sur la première étape réellement en attente. Sans ça
    // le cockpit reste bloqué (l'étape courante n'a pas de bouton « Valider »).
    let currentStep = instance.currentStep
    let status = instance.status as string
    if (status === 'IN_PROGRESS') {
      const total = instance.steps.length
      const sByIdx = new Map(instance.steps.map((s) => [s.stepIndex, s.status]))
      let computed = total
      for (let i = 0; i < total; i++) {
        const st = sByIdx.get(i)
        if (st !== 'COMPLETED' && st !== 'SKIPPED') { computed = i; break }
      }
      if (computed >= total) {
        // Toutes les étapes sont terminées → marquer l'instance comme terminée
        status = 'COMPLETED'
        currentStep = total > 0 ? total - 1 : 0
        await prisma.parcourInstance.update({ where: { id }, data: { status: 'COMPLETED', currentStep } })
        await prisma.parcourHistory.create({ data: { instanceId: id, userId, action: 'completed' } }).catch(() => {})
      } else if (computed !== currentStep) {
        currentStep = computed
        await prisma.parcourInstance.update({ where: { id }, data: { currentStep } })
      }
    }

    return {
      id: instance.id,
      templateId: instance.templateId,
      ownerId: instance.ownerId,
      title: instance.title,
      refNumber: instance.refNumber,
      status,
      priority: instance.priority,
      currentStep,
      dueAt: instance.dueAt,
      remindByEmail: instance.remindByEmail,
      data: instance.data,
      role,
      steps: instance.template.steps,
      stepInstances: instance.steps,
      documents: instance.documents,
      history: instance.history,
      createdAt: instance.createdAt,
      updatedAt: instance.updatedAt,
    }
  })

  // Démarrer une instance depuis un template.
  app.post('/instances', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = instanceCreateSchema.parse(request.body)
    const template = await prisma.parcourTemplate.findUnique({ where: { id: body.templateId } })
    if (!template) return reply.status(404).send({ error: 'Template introuvable' })

    const refNumber = await generateRefNumber(template.category)
    const steps = Array.isArray(template.steps) ? template.steps as { assignedTo?: string; slaDays?: number }[] : []
    const now = new Date()
    const firstDueAt = steps[0]?.slaDays
      ? new Date(now.getTime() + steps[0].slaDays * 24 * 60 * 60 * 1000)
      : null

    const instance = await prisma.parcourInstance.create({
      data: {
        templateId: body.templateId,
        ownerId,
        title: body.title.trim(),
        refNumber,
        priority: body.priority ?? 'normal',
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        steps: {
          create: steps.map((s, idx) => ({
            stepIndex: idx,
            status: 'PENDING',
            assignedTo: idx === 0 ? (s.assignedTo ?? null) : null,
            dueAt: idx === 0 ? firstDueAt : null,
          })),
        },
        history: {
          create: { userId: ownerId, action: 'started' },
        },
      },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        history: true,
      },
    })

    // Ajouter les observateurs par défaut du template
    if (template.defaultObservers.length > 0) {
      const observers = template.defaultObservers.filter((id) => id !== ownerId)
      if (observers.length > 0) {
        await prisma.moduleShare.createMany({
          data: observers.map((userId) => ({ module: 'parcourInstance', resourceId: instance.id, userId, role: 'VIEWER' as const })),
          skipDuplicates: true,
        })
      }
    }

    // Déclencher l'action automatique de la première étape si c'est un step module
    const firstStepDef = steps[0] as ModuleStepDef | undefined
    if (firstStepDef?.moduleAction) {
      const actionData = await triggerModuleAction(firstStepDef, ownerId, body.title)
      if (actionData) {
        await prisma.parcourStepInstance.update({
          where: { instanceId_stepIndex: { instanceId: instance.id, stepIndex: 0 } },
          data: { data: actionData as Prisma.InputJsonValue },
        })
      }
    }

    // Notifier l'assigné de la première étape
    const firstStep = instance.steps[0]
    if (firstStep?.assignedTo && firstStep.assignedTo !== ownerId) {
      await notify({
        userId: firstStep.assignedTo,
        type: 'PARCOURS_STEP_ASSIGNED',
        title: `Étape à compléter dans "${instance.title}"`,
        body: `Réf. ${refNumber} — étape 1`,
        link: `/parcours/run/${instance.id}`,
      })
      await sendParcoursStepAssignedEmail(
        firstStep.assignedTo, instance.title,
        (steps[0] as { title?: string })?.title ?? 'Étape 1', 1,
        refNumber, `${FRONTEND_URL}/parcours/run/${instance.id}`,
      ).catch(() => {})
    }

    return reply.status(201).send({ ...instance, role: 'OWNER', refNumber })
  })

  // Compléter ou rejeter une étape.
  app.post('/instances/:id/steps/:idx', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, idx } = request.params as { id: string; idx: string }
    const stepIndex = parseInt(idx, 10)
    const body = stepCompleteSchema.parse(request.body)

    const instance = await prisma.parcourInstance.findUnique({
      where: { id },
      include: { template: { select: { steps: true } }, steps: { select: { stepIndex: true, status: true } } },
    })
    if (!instance) return reply.status(404).send({ error: 'Instance introuvable' })

    const role = await resolveRole('parcourInstance', id, userId, instance.ownerId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })
    if (instance.status !== 'IN_PROGRESS') return reply.status(400).send({ error: 'Instance non active' })
    if (stepIndex !== instance.currentStep) return reply.status(400).send({ error: 'Ce n\'est pas l\'étape courante' })

    const steps = Array.isArray(instance.template.steps) ? instance.template.steps as { assignedTo?: string }[] : []
    const newStatus = body.action === 'complete' ? 'COMPLETED' : 'REJECTED'
    const now = new Date()

    // Persister le commentaire dans les données de l'étape, pour qu'il reste visible
    // sur l'étape (le cockpit lit si.data.comment) en plus de l'historique.
    const stepData = (body.data || body.comment)
      ? { ...(body.data ?? {}), ...(body.comment ? { comment: body.comment } : {}) }
      : null

    // Mettre à jour l'étape courante
    await prisma.parcourStepInstance.update({
      where: { instanceId_stepIndex: { instanceId: id, stepIndex } },
      data: { status: newStatus, completedBy: userId, completedAt: now, data: (stepData ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    })

    // Journal métier
    await prisma.parcourHistory.create({
      data: {
        instanceId: id,
        stepIndex,
        userId,
        action: body.action === 'complete' ? 'step_completed' : 'step_rejected',
        comment: body.comment ?? null,
      },
    })

    let instanceStatus = instance.status as string

    // Calcul robuste de la prochaine étape courante : on saute les étapes déjà
    // terminées (COMPLETED/SKIPPED, ex. validées dans le désordre via force-complete),
    // pour ne jamais laisser currentStep pointer sur une étape déjà traitée.
    const statuses = new Map<number, string>(instance.steps.map((s) => [s.stepIndex, s.status]))
    statuses.set(stepIndex, newStatus)
    let nextStep = steps.length // sentinelle : tout est terminé
    for (let i = 0; i < steps.length; i++) {
      const st = statuses.get(i)
      if (st !== 'COMPLETED' && st !== 'SKIPPED') { nextStep = i; break }
    }

    if (body.action === 'reject') {
      // Rejet d'étape : l'instance reste IN_PROGRESS, l'étape est bloquée
      // L'utilisateur doit réinitialiser l'étape pour reprendre le flux
      nextStep = stepIndex
    } else if (nextStep >= steps.length) {
      // Plus aucune étape en attente → parcours terminé
      nextStep = steps.length - 1
      instanceStatus = 'COMPLETED'
      await prisma.parcourHistory.create({
        data: { instanceId: id, userId, action: 'completed' },
      })
      await notify({
        userId: instance.ownerId,
        type: 'PARCOURS_INSTANCE_COMPLETED',
        title: `Parcours terminé : "${instance.title}"`,
        link: `/parcours/run/${id}`,
      })
    } else if (statuses.get(nextStep) === 'PENDING') {
      // Activer la nouvelle étape courante
      const nextStepDef = steps[nextStep] as ModuleStepDef
      const nextStepDefFull = (Array.isArray(instance.template.steps) ? instance.template.steps as { slaDays?: number }[] : [])[nextStep]
      const actionData = await triggerModuleAction(nextStepDef, instance.ownerId, instance.title)
      // Calculer la dueAt de la prochaine étape depuis slaDays
      const nextDueAt = nextStepDefFull?.slaDays
        ? new Date(now.getTime() + nextStepDefFull.slaDays * 24 * 60 * 60 * 1000)
        : null
      await prisma.parcourStepInstance.update({
        where: { instanceId_stepIndex: { instanceId: id, stepIndex: nextStep } },
        data: {
          assignedTo: nextStepDef?.assignedTo ?? null,
          dueAt: nextDueAt,
          ...(actionData ? { data: actionData as Prisma.InputJsonValue } : {}),
        },
      })
      // Notifier l'assigné de l'étape suivante
      if (nextStepDef?.assignedTo) {
        await notify({
          userId: nextStepDef.assignedTo,
          type: 'PARCOURS_STEP_ASSIGNED',
          title: `Étape à compléter dans "${instance.title}"`,
          body: `Étape ${nextStep + 1}`,
          link: `/parcours/run/${id}`,
        })
        await sendParcoursStepAssignedEmail(
          nextStepDef.assignedTo, instance.title,
          (steps[nextStep] as { title?: string })?.title ?? `Étape ${nextStep + 1}`, nextStep + 1,
          instance.refNumber, `${FRONTEND_URL}/parcours/run/${id}`,
        ).catch(() => {})
      }
    }

    await prisma.parcourInstance.update({
      where: { id },
      data: {
        currentStep: nextStep,
        status: instanceStatus as never,
        updatedAt: now,
      },
    })

    // Notifier l'initiateur si l'étape a été complétée par quelqu'un d'autre
    if (userId !== instance.ownerId) {
      await notify({
        userId: instance.ownerId,
        type: 'PARCOURS_STEP_COMPLETED',
        title: `Étape ${stepIndex + 1} complétée dans "${instance.title}"`,
        link: `/parcours/run/${id}`,
      })
    }

    return reply.send({ ok: true, nextStep, instanceStatus })
  })

  // ── Documents ──────────────────────────────────────────────────────────────────

  // Générer une signed URL d'upload GCS.
  app.post('/instances/:id/documents/upload-url', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { filename, mimeType } = request.body as { filename: string; mimeType: string }
    if (!filename || !mimeType) return reply.status(400).send({ error: 'filename et mimeType requis' })

    const { role } = await instanceRoleFor(id, userId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    const ext = filename.split('.').pop() ?? 'bin'
    const key = `parcours/${id}/${crypto.randomUUID()}.${ext}`
    const uploadUrl = await getUploadSignedUrl(key, mimeType)
    return { uploadUrl, key }
  })

  // Enregistrer un document après upload GCS.
  app.post('/instances/:id/documents', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await instanceRoleFor(id, userId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    const body = documentRegisterSchema.parse(request.body)
    const doc = await prisma.parcourDocument.create({
      data: {
        instanceId: id,
        stepIndex: body.stepIndex ?? null,
        filename: body.filename,
        mimeType: body.mimeType,
        storageKey: body.storageKey,
        sizeBytes: body.sizeBytes,
        classification: body.classification ?? 'C1',
        uploadedBy: userId,
      },
    })
    await prisma.parcourHistory.create({
      data: { instanceId: id, stepIndex: body.stepIndex ?? null, userId, action: 'document_added', comment: body.filename },
    })
    await prisma.parcourInstance.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.status(201).send(doc)
  })

  // Signed URL de téléchargement.
  app.get('/documents/:docId/url', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { docId } = request.params as { docId: string }
    const doc = await prisma.parcourDocument.findUnique({ where: { id: docId } })
    if (!doc) return reply.status(404).send({ error: 'Document introuvable' })

    const role = await resolveRole('parcourInstance', doc.instanceId, userId, doc.uploadedBy)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })

    const url = await getDownloadSignedUrl(doc.storageKey)
    return { url, filename: doc.filename, mimeType: doc.mimeType }
  })

  // Suppression d'un document.
  app.delete('/documents/:docId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { docId } = request.params as { docId: string }
    const doc = await prisma.parcourDocument.findUnique({ where: { id: docId } })
    if (!doc) return reply.status(404).send({ error: 'Document introuvable' })

    const instance = await prisma.parcourInstance.findUnique({ where: { id: doc.instanceId }, select: { ownerId: true } })
    if (!instance) return reply.status(404).send({ error: 'Instance introuvable' })
    const role = await resolveRole('parcourInstance', doc.instanceId, userId, instance.ownerId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    await prisma.parcourDocument.delete({ where: { id: docId } })
    await deleteStorageFile(doc.storageKey)
    return reply.status(204).send()
  })

  // ── Instance settings ─────────────────────────────────────────────────────────

  // Mise à jour légère : titre, priorité, dueAt, remindByEmail.
  app.patch('/instances/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await instanceRoleFor(id, userId)
    if (!role || role === 'VIEWER') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Instance introuvable' })

    const body = z.object({
      title: z.string().min(1).max(200).optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      dueAt: z.string().datetime().nullable().optional(),
      remindByEmail: z.boolean().optional(),
    }).parse(request.body)

    const updated = await prisma.parcourInstance.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.dueAt !== undefined && { dueAt: body.dueAt ? new Date(body.dueAt) : null }),
        ...(body.remindByEmail !== undefined && { remindByEmail: body.remindByEmail }),
      },
    })
    return { ok: true, remindByEmail: updated.remindByEmail }
  })

  // Ajouter un commentaire libre (sans compléter l'étape).
  app.post('/instances/:id/comment', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await instanceRoleFor(id, userId)
    if (!role) return reply.status(404).send({ error: 'Instance introuvable' })

    const { comment } = z.object({ comment: z.string().min(1).max(2000) }).parse(request.body)
    const entry = await prisma.parcourHistory.create({
      data: { instanceId: id, userId, action: 'comment', comment },
    })
    await prisma.parcourInstance.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.status(201).send(entry)
  })

  // Ajouter un commentaire sur une étape spécifique.
  app.post('/instances/:id/steps/:idx/comment', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, idx } = request.params as { id: string; idx: string }
    const stepIndex = parseInt(idx, 10)
    const { role } = await instanceRoleFor(id, userId)
    if (!role) return reply.status(404).send({ error: 'Instance introuvable' })

    const { comment } = z.object({ comment: z.string().min(1).max(2000) }).parse(request.body)
    const entry = await prisma.parcourHistory.create({
      data: { instanceId: id, stepIndex, userId, action: 'comment', comment },
    })
    await prisma.parcourInstance.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.status(201).send(entry)
  })

  // ── Stars ──────────────────────────────────────────────────────────────────────

  // Toggle star sur un template (crée ou supprime).
  app.post('/templates/:id/star', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id: templateId } = request.params as { id: string }

    const existing = await prisma.parcourStar.findUnique({ where: { userId_templateId: { userId, templateId } } })
    if (existing) {
      await prisma.$transaction([
        prisma.parcourStar.delete({ where: { userId_templateId: { userId, templateId } } }),
        prisma.parcourTemplate.update({ where: { id: templateId }, data: { starCount: { decrement: 1 } } }),
      ])
      return { starred: false }
    } else {
      await prisma.$transaction([
        prisma.parcourStar.create({ data: { userId, templateId } }),
        prisma.parcourTemplate.update({ where: { id: templateId }, data: { starCount: { increment: 1 } } }),
      ])
      return { starred: true }
    }
  })

  // Retourne les templateIds que l'utilisateur a starrés (pour affichage côté client).
  app.get('/stars', async (request) => {
    const { id: userId } = request.user as { id: string }
    const stars = await prisma.parcourStar.findMany({ where: { userId }, select: { templateId: true } })
    return stars.map((s) => s.templateId)
  })

  // ── Reopen step ───────────────────────────────────────────────────────────────

  // Reprendre depuis une étape passée : remet l'étape idx et toutes les suivantes
  // en PENDING, repositionne currentStep sur idx, et remet le parcours IN_PROGRESS.
  app.post('/instances/:id/steps/:idx/reopen', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, idx } = request.params as { id: string; idx: string }
    const stepIndex = parseInt(idx, 10)

    const instance = await prisma.parcourInstance.findUnique({
      where: { id },
      include: { steps: { select: { stepIndex: true } } },
    })
    if (!instance) return reply.status(404).send({ error: 'Instance introuvable' })

    const role = await resolveRole('parcourInstance', id, userId, instance.ownerId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })
    if (stepIndex >= instance.currentStep && instance.status === 'IN_PROGRESS') {
      return reply.status(400).send({ error: 'Cette étape est déjà en cours ou future' })
    }

    // Remettre en PENDING toutes les étapes à partir de stepIndex
    await prisma.parcourStepInstance.updateMany({
      where: { instanceId: id, stepIndex: { gte: stepIndex } },
      data: { status: 'PENDING', completedBy: null, completedAt: null, dueAt: null, notifiedAt: null },
    })

    await prisma.parcourInstance.update({
      where: { id },
      data: { currentStep: stepIndex, status: 'IN_PROGRESS', updatedAt: new Date() },
    })

    await prisma.parcourHistory.create({
      data: { instanceId: id, stepIndex, userId, action: 'step_reopened', comment: `Retour à l'étape ${stepIndex + 1}` },
    })

    return reply.send({ ok: true })
  })

  // ── Force-complete (valider n'importe quelle étape manuellement) ─────────────

  app.post('/instances/:id/steps/:idx/force-complete', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, idx } = request.params as { id: string; idx: string }
    const stepIndex = parseInt(idx, 10)
    const body = z.object({
      data: z.record(z.unknown()).optional(),
      comment: z.string().max(2000).optional(),
    }).parse(request.body)

    const instance = await prisma.parcourInstance.findUnique({
      where: { id },
      include: { template: { select: { steps: true } }, steps: { select: { stepIndex: true, status: true } } },
    })
    if (!instance) return reply.status(404).send({ error: 'Instance introuvable' })

    const role = await resolveRole('parcourInstance', id, userId, instance.ownerId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    const steps = Array.isArray(instance.template.steps) ? instance.template.steps as { assignedTo?: string; slaDays?: number }[] : []
    if (stepIndex < 0 || stepIndex >= steps.length) return reply.status(400).send({ error: 'Index d\'étape invalide' })

    const now = new Date()
    await prisma.parcourStepInstance.update({
      where: { instanceId_stepIndex: { instanceId: id, stepIndex } },
      data: { status: 'COMPLETED', completedBy: userId, completedAt: now, data: (body.data ?? Prisma.JsonNull) as Prisma.InputJsonValue },
    })
    await prisma.parcourHistory.create({
      data: { instanceId: id, stepIndex, userId, action: 'step_force_completed', comment: body.comment ?? null },
    })

    // Recalculer currentStep robustement : on peut valider une étape dans le désordre
    // (force-complete sur une étape future). currentStep doit toujours pointer vers la
    // première étape non terminée (ni COMPLETED ni SKIPPED), sinon le cockpit affiche
    // « étape pas encore active » pour les étapes suivantes alors que tout est validé.
    const statuses = new Map<number, string>(instance.steps.map((s) => [s.stepIndex, s.status]))
    statuses.set(stepIndex, 'COMPLETED')

    let nextCurrentStep = steps.length // sentinelle : tout est terminé
    for (let i = 0; i < steps.length; i++) {
      const st = statuses.get(i)
      if (st !== 'COMPLETED' && st !== 'SKIPPED') { nextCurrentStep = i; break }
    }

    let instanceStatus = instance.status as string

    if (nextCurrentStep >= steps.length) {
      // Plus aucune étape en attente → parcours terminé
      instanceStatus = 'COMPLETED'
      nextCurrentStep = steps.length - 1
      await prisma.parcourHistory.create({ data: { instanceId: id, userId, action: 'completed' } })
      await notify({ userId: instance.ownerId, type: 'PARCOURS_INSTANCE_COMPLETED', title: `Parcours terminé : "${instance.title}"`, link: `/parcours/run/${id}` })
    } else if (nextCurrentStep !== instance.currentStep && statuses.get(nextCurrentStep) === 'PENDING') {
      // La nouvelle étape courante devient active : assignation, échéance, notification.
      // On ne re-déclenche pas triggerModuleAction (éviter la création de ressources en double).
      const nextStepDef = steps[nextCurrentStep] as ModuleStepDef
      const nextDueAt = (steps[nextCurrentStep] as { slaDays?: number })?.slaDays
        ? new Date(now.getTime() + (steps[nextCurrentStep] as { slaDays: number }).slaDays * 24 * 60 * 60 * 1000)
        : null
      await prisma.parcourStepInstance.update({
        where: { instanceId_stepIndex: { instanceId: id, stepIndex: nextCurrentStep } },
        data: { assignedTo: nextStepDef?.assignedTo ?? null, dueAt: nextDueAt },
      })
      if (nextStepDef?.assignedTo) {
        await notify({ userId: nextStepDef.assignedTo, type: 'PARCOURS_STEP_ASSIGNED', title: `Étape à compléter dans "${instance.title}"`, link: `/parcours/run/${id}` })
        await sendParcoursStepAssignedEmail(
          nextStepDef.assignedTo, instance.title,
          (steps[nextCurrentStep] as { title?: string })?.title ?? `Étape ${nextCurrentStep + 1}`, nextCurrentStep + 1,
          instance.refNumber, `${FRONTEND_URL}/parcours/run/${id}`,
        ).catch(() => {})
      }
    }

    await prisma.parcourInstance.update({
      where: { id },
      data: { currentStep: nextCurrentStep, status: instanceStatus as never, updatedAt: now },
    })
    return reply.send({ ok: true })
  })

  // ── Reset d'une seule étape (sans cascade) ────────────────────────────────────

  app.post('/instances/:id/steps/:idx/reset', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, idx } = request.params as { id: string; idx: string }
    const stepIndex = parseInt(idx, 10)

    const instance = await prisma.parcourInstance.findUnique({
      where: { id },
      include: { template: { select: { steps: true } } },
    })
    if (!instance) return reply.status(404).send({ error: 'Instance introuvable' })

    const role = await resolveRole('parcourInstance', id, userId, instance.ownerId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    const stepCount = Array.isArray(instance.template.steps) ? (instance.template.steps as unknown[]).length : 0
    if (stepIndex < 0 || stepIndex >= stepCount) return reply.status(400).send({ error: 'Index d\'étape invalide' })

    await prisma.parcourStepInstance.update({
      where: { instanceId_stepIndex: { instanceId: id, stepIndex } },
      data: { status: 'PENDING', completedBy: null, completedAt: null, data: Prisma.JsonNull, notifiedAt: null },
    })

    const newCurrentStep = Math.min(instance.currentStep, stepIndex)
    const newStatus = (instance.status === 'COMPLETED' || instance.status === 'REJECTED') ? 'IN_PROGRESS' : instance.status

    await prisma.parcourInstance.update({
      where: { id },
      data: { currentStep: newCurrentStep, status: newStatus as never, updatedAt: new Date() },
    })
    await prisma.parcourHistory.create({
      data: { instanceId: id, stepIndex, userId, action: 'step_reset', comment: `Étape ${stepIndex + 1} réinitialisée` },
    })
    return reply.send({ ok: true })
  })

  // ── Mise à jour des données d'une étape ───────────────────────────────────────

  app.patch('/instances/:id/steps/:idx/data', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, idx } = request.params as { id: string; idx: string }
    const stepIndex = parseInt(idx, 10)
    const { data } = z.object({ data: z.record(z.unknown()) }).parse(request.body)

    const instance = await prisma.parcourInstance.findUnique({ where: { id } })
    if (!instance) return reply.status(404).send({ error: 'Instance introuvable' })

    const role = await resolveRole('parcourInstance', id, userId, instance.ownerId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    await prisma.parcourStepInstance.update({
      where: { instanceId_stepIndex: { instanceId: id, stepIndex } },
      data: { data: data as Prisma.InputJsonValue },
    })
    await prisma.parcourHistory.create({
      data: { instanceId: id, stepIndex, userId, action: 'step_data_edited' },
    })
    await prisma.parcourInstance.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.send({ ok: true })
  })

  // ── Restart ────────────────────────────────────────────────────────────────────

  // Relancer une instance rejetée ou annulée depuis l'étape courante.
  app.post('/instances/:id/restart', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }

    const instance = await prisma.parcourInstance.findUnique({ where: { id } })
    if (!instance) return reply.status(404).send({ error: 'Instance introuvable' })

    const role = await resolveRole('parcourInstance', id, userId, instance.ownerId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })
    if (instance.status === 'IN_PROGRESS' || instance.status === 'COMPLETED') {
      return reply.status(400).send({ error: 'Seules les instances rejetées ou annulées peuvent être relancées' })
    }

    // Remettre l'étape courante en PENDING et l'instance en IN_PROGRESS
    await prisma.parcourStepInstance.update({
      where: { instanceId_stepIndex: { instanceId: id, stepIndex: instance.currentStep } },
      data: { status: 'PENDING', completedBy: null, completedAt: null, data: Prisma.JsonNull },
    })
    await prisma.parcourInstance.update({
      where: { id },
      data: { status: 'IN_PROGRESS', updatedAt: new Date() },
    })
    await prisma.parcourHistory.create({
      data: { instanceId: id, userId, action: 'restarted', comment: 'Relancé depuis l\'étape ' + (instance.currentStep + 1) },
    })

    return reply.send({ ok: true })
  })

  // ── Skip step ─────────────────────────────────────────────────────────────────

  // Passe une étape (SKIPPED) et avance au suivant. Réservé à OWNER/EDITOR.
  app.post('/instances/:id/steps/:idx/skip', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, idx } = request.params as { id: string; idx: string }
    const stepIndex = parseInt(idx, 10)
    const { comment } = z.object({ comment: z.string().max(500).optional() }).parse(request.body ?? {})

    const instance = await prisma.parcourInstance.findUnique({
      where: { id },
      include: { template: { select: { steps: true } }, steps: { select: { stepIndex: true, status: true } } },
    })
    if (!instance) return reply.status(404).send({ error: 'Instance introuvable' })

    const role = await resolveRole('parcourInstance', id, userId, instance.ownerId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })
    if (instance.status !== 'IN_PROGRESS') return reply.status(400).send({ error: 'Instance non active' })

    const steps = Array.isArray(instance.template.steps) ? instance.template.steps as { assignedTo?: string; slaDays?: number }[] : []
    if (stepIndex < 0 || stepIndex >= steps.length) return reply.status(400).send({ error: 'Index d\'étape invalide' })

    const now = new Date()
    await prisma.parcourStepInstance.update({
      where: { instanceId_stepIndex: { instanceId: id, stepIndex } },
      data: { status: 'SKIPPED', completedBy: userId, completedAt: now },
    })
    await prisma.parcourHistory.create({
      data: { instanceId: id, stepIndex, userId, action: 'step_skipped', comment: comment ?? null },
    })

    const nextStep = stepIndex + 1
    let instanceStatus = instance.status as string

    if (nextStep >= steps.length) {
      const allDone = instance.steps.every((s) => s.stepIndex === stepIndex ? true : s.status === 'COMPLETED' || s.status === 'SKIPPED')
      if (allDone) {
        instanceStatus = 'COMPLETED'
        await prisma.parcourHistory.create({ data: { instanceId: id, userId, action: 'completed' } })
        await notify({ userId: instance.ownerId, type: 'PARCOURS_INSTANCE_COMPLETED', title: `Parcours terminé : "${instance.title}"`, link: `/parcours/run/${id}` })
      }
    } else {
      const nextStepDef = steps[nextStep] as ModuleStepDef
      const nextDueAt = (steps[nextStep] as { slaDays?: number })?.slaDays
        ? new Date(now.getTime() + (steps[nextStep] as { slaDays: number }).slaDays * 24 * 60 * 60 * 1000)
        : null
      const actionData = await triggerModuleAction(nextStepDef, instance.ownerId, instance.title)
      await prisma.parcourStepInstance.update({
        where: { instanceId_stepIndex: { instanceId: id, stepIndex: nextStep } },
        data: { assignedTo: nextStepDef?.assignedTo ?? null, dueAt: nextDueAt, ...(actionData ? { data: actionData as Prisma.InputJsonValue } : {}) },
      })
      if (nextStepDef?.assignedTo) {
        await notify({ userId: nextStepDef.assignedTo, type: 'PARCOURS_STEP_ASSIGNED', title: `Étape à compléter dans "${instance.title}"`, link: `/parcours/run/${id}` })
        await sendParcoursStepAssignedEmail(
          nextStepDef.assignedTo, instance.title,
          (steps[nextStep] as { title?: string })?.title ?? `Étape ${nextStep + 1}`, nextStep + 1,
          instance.refNumber, `${FRONTEND_URL}/parcours/run/${id}`,
        ).catch(() => {})
      }
    }

    await prisma.parcourInstance.update({
      where: { id },
      data: { currentStep: nextStep < steps.length ? nextStep : stepIndex, status: instanceStatus as never, updatedAt: now },
    })
    return reply.send({ ok: true })
  })

  // ── Cancel instance ────────────────────────────────────────────────────────────

  // Annule définitivement l'instance (CANCELLED). OWNER uniquement.
  app.post('/instances/:id/cancel', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { comment } = z.object({ comment: z.string().max(500).optional() }).parse(request.body ?? {})

    const instance = await prisma.parcourInstance.findUnique({ where: { id } })
    if (!instance) return reply.status(404).send({ error: 'Instance introuvable' })

    const role = await resolveRole('parcourInstance', id, userId, instance.ownerId)
    if (role !== 'OWNER') return reply.status(403).send({ error: 'Seul le propriétaire peut annuler un parcours' })
    if (instance.status === 'COMPLETED' || instance.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Ce parcours ne peut pas être annulé' })
    }

    await prisma.parcourInstance.update({ where: { id }, data: { status: 'CANCELLED', updatedAt: new Date() } })
    await prisma.parcourHistory.create({ data: { instanceId: id, userId, action: 'cancelled', comment: comment ?? null } })
    return reply.send({ ok: true })
  })

}
