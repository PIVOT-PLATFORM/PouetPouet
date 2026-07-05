import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import crypto from 'node:crypto'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares, canManage } from '../../lib/module-share.js'

// Module PI Planning — socle : cycle (PI), itérations générées automatiquement
// (IT1…ITn + IP Sprint), équipes du Train (snapshot du pivot Team). Le RTE est
// OWNER, les Scrum Masters invités EDITOR (ModuleShare module='pi').
// Composition inter-modules par références lâches : logisticsFormId (module
// Formulaires — formulaire logistique créé depuis un template) et
// todoDashboardId (module To-Do — tableau des tâches du Train).

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format yyyy-mm-dd')
const CYCLE_STATUSES = ['PREPARATION', 'ACTIVE', 'CLOSED'] as const

const cycleCreateSchema = z.object({
  name: z.string().min(1).max(120),
  artName: z.string().max(120).nullable().optional(),
  startDate: ISO_DATE,
  iterationCount: z.number().int().min(1).max(12).default(5),
  iterationWeeks: z.number().int().min(1).max(6).default(2),
  eventDay1: ISO_DATE.nullable().optional(),
  eventDay2: ISO_DATE.nullable().optional(),
  eventLocation: z.string().max(300).nullable().optional(),
})

const cycleUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  artName: z.string().max(120).nullable().optional(),
  status: z.enum(CYCLE_STATUSES).optional(),
  eventDay1: ISO_DATE.nullable().optional(),
  eventDay2: ISO_DATE.nullable().optional(),
  eventLocation: z.string().max(300).nullable().optional(),
  todoDashboardId: z.string().nullable().optional(),
})

const iterationUpdateSchema = z.object({
  label: z.string().min(1).max(60).optional(),
  startDate: ISO_DATE.optional(),
  endDate: ISO_DATE.optional(),
})

const teamCreateSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})
const teamUpdateSchema = teamCreateSchema.partial().extend({
  order: z.number().int().min(0).optional(),
})

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000)
}

// Génère les créneaux d'itérations : IT1…ITn consécutives de `weeks` semaines,
// puis un « IP Sprint » de même durée (numéro n+1).
export function generateIterations(start: Date, count: number, weeks: number): { number: number; label: string; startDate: Date; endDate: Date }[] {
  const iterations: { number: number; label: string; startDate: Date; endDate: Date }[] = []
  let cursor = start
  for (let i = 1; i <= count; i++) {
    const end = addDays(cursor, weeks * 7 - 1)
    iterations.push({ number: i, label: `IT${i}`, startDate: cursor, endDate: end })
    cursor = addDays(end, 1)
  }
  iterations.push({ number: count + 1, label: 'IP Sprint', startDate: cursor, endDate: addDays(cursor, weeks * 7 - 1) })
  return iterations
}

// Champs du formulaire logistique pré-rempli (module Formulaires). Les libellés
// de présence reprennent les dates de l'événement si connues.
function logisticsFields(eventDay1: Date | null, eventDay2: Date | null) {
  const fr = (d: Date) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const day1 = eventDay1 ? fr(eventDay1) : 'Jour 1'
  const day2 = eventDay2 ? fr(eventDay2) : 'Jour 2'
  return [
    { id: 'presence', label: 'Jours de présence', type: 'checkboxes', required: true, options: [day1, day2] },
    { id: 'hotel', label: "Besoin d'une chambre d'hôtel", type: 'radio', required: true, options: ['Oui', 'Non'] },
    { id: 'repas', label: 'Repas à prévoir', type: 'checkboxes', required: false, options: ['Midi J1', 'Soir J1', 'Midi J2'] },
    { id: 'allergies', label: 'Allergies / régimes spécifiques', type: 'long_text', required: false },
  ]
}

export const piRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  async function roleFor(cycleId: string, userId: string) {
    const cycle = await prisma.piCycle.findUnique({ where: { id: cycleId }, select: { ownerId: true } })
    if (!cycle) return { role: null, ownerId: null }
    const role = await resolveRole('pi', cycleId, userId, cycle.ownerId)
    return { role, ownerId: cycle.ownerId }
  }

  // ── Cycles (PI) ─────────────────────────────────────────────────────────────

  // Liste : cycles possédés + partagés.
  app.get('/cycles', async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('pi', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const cycles = await prisma.piCycle.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      include: { _count: { select: { iterations: true, teams: true } } },
      orderBy: { startDate: 'desc' },
    })
    return cycles.map((c) => ({
      id: c.id,
      name: c.name,
      artName: c.artName,
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      iterationCount: c._count.iterations,
      teamCount: c._count.teams,
      role: c.ownerId === userId ? 'OWNER' : (sharedRole.get(c.id) ?? 'VIEWER'),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
  })

  // Création : le PI génère automatiquement ses itérations.
  app.post('/cycles', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = cycleCreateSchema.parse(request.body)
    const start = toDate(body.startDate)
    const iterations = generateIterations(start, body.iterationCount, body.iterationWeeks)
    const cycle = await prisma.piCycle.create({
      data: {
        ownerId,
        name: body.name.trim(),
        artName: body.artName?.trim() || null,
        startDate: start,
        endDate: iterations[iterations.length - 1].endDate,
        eventDay1: body.eventDay1 ? toDate(body.eventDay1) : null,
        eventDay2: body.eventDay2 ? toDate(body.eventDay2) : null,
        eventLocation: body.eventLocation?.trim() || null,
        iterations: { create: iterations },
      },
      include: { iterations: { orderBy: { number: 'asc' } }, teams: true },
    })
    return reply.status(201).send({ ...cycle, role: 'OWNER' })
  })

  // Détail : itérations + équipes + résumé des ressources liées (Forms / To-Do).
  app.get('/cycles/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const cycle = await prisma.piCycle.findUnique({
      where: { id },
      include: {
        iterations: { orderBy: { number: 'asc' } },
        teams: { orderBy: { order: 'asc' } },
      },
    })
    if (!cycle) return reply.status(404).send({ error: 'PI introuvable.' })
    const role = await resolveRole('pi', id, userId, cycle.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé.' })

    // Références lâches : résumées si la cible existe encore, null sinon.
    let logisticsForm: { id: string; title: string; recipientCount: number; respondedCount: number; responseCount: number } | null = null
    if (cycle.logisticsFormId) {
      const form = await prisma.form.findUnique({
        where: { id: cycle.logisticsFormId },
        select: { id: true, title: true, _count: { select: { responses: true } }, recipients: { select: { respondedAt: true } } },
      })
      if (form) {
        logisticsForm = {
          id: form.id,
          title: form.title,
          recipientCount: form.recipients.length,
          respondedCount: form.recipients.filter((r) => r.respondedAt !== null).length,
          responseCount: form._count.responses,
        }
      }
    }
    let todoDashboard: { id: string; name: string; listCount: number } | null = null
    if (cycle.todoDashboardId) {
      const db = await prisma.todoDashboard.findUnique({
        where: { id: cycle.todoDashboardId },
        select: { id: true, name: true, _count: { select: { lists: true } } },
      })
      if (db) todoDashboard = { id: db.id, name: db.name, listCount: db._count.lists }
    }

    return {
      id: cycle.id,
      name: cycle.name,
      artName: cycle.artName,
      status: cycle.status,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      eventDay1: cycle.eventDay1,
      eventDay2: cycle.eventDay2,
      eventLocation: cycle.eventLocation,
      iterations: cycle.iterations,
      teams: cycle.teams,
      logisticsForm,
      todoDashboard,
      ownerId: cycle.ownerId,
      role,
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt,
    }
  })

  app.patch('/cycles/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const body = cycleUpdateSchema.parse(request.body)

    // Lier un TodoDashboard : l'appelant doit y avoir accès (sinon fuite de
    // stats d'un dashboard privé via la carte Tâches du PI).
    if (body.todoDashboardId) {
      const db = await prisma.todoDashboard.findUnique({ where: { id: body.todoDashboardId }, select: { ownerId: true } })
      if (!db) return reply.status(404).send({ error: 'Tableau de bord To-Do introuvable.' })
      const dbRole = await resolveRole('tododashboard', body.todoDashboardId, userId, db.ownerId)
      if (!dbRole) return reply.status(403).send({ error: 'Accès refusé à ce tableau de bord To-Do.' })
    }

    const updated = await prisma.piCycle.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.artName !== undefined && { artName: body.artName?.trim() || null }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.eventDay1 !== undefined && { eventDay1: body.eventDay1 ? toDate(body.eventDay1) : null }),
        ...(body.eventDay2 !== undefined && { eventDay2: body.eventDay2 ? toDate(body.eventDay2) : null }),
        ...(body.eventLocation !== undefined && { eventLocation: body.eventLocation?.trim() || null }),
        ...(body.todoDashboardId !== undefined && { todoDashboardId: body.todoDashboardId }),
      },
      include: { iterations: { orderBy: { number: 'asc' } }, teams: { orderBy: { order: 'asc' } } },
    })
    return { ...updated, role }
  })

  // Suppression — propriétaire uniquement. Le formulaire logistique et le
  // TodoDashboard liés ne sont PAS supprimés (ils vivent dans leurs modules).
  app.delete('/cycles/:id', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const cycle = await prisma.piCycle.findFirst({ where: { id, ownerId } })
    if (!cycle) return reply.status(404).send({ error: 'PI introuvable.' })
    await prisma.piCycle.delete({ where: { id } })
    await deleteResourceShares('pi', id)
    return reply.status(204).send()
  })

  // ── Itérations ──────────────────────────────────────────────────────────────

  app.patch('/cycles/:id/iterations/:iterationId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, iterationId } = request.params as { id: string; iterationId: string }
    const { role } = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const existing = await prisma.piIteration.findFirst({ where: { id: iterationId, cycleId: id } })
    if (!existing) return reply.status(404).send({ error: 'Itération introuvable.' })
    const body = iterationUpdateSchema.parse(request.body)
    const startDate = body.startDate ? toDate(body.startDate) : existing.startDate
    const endDate = body.endDate ? toDate(body.endDate) : existing.endDate
    if (startDate > endDate) return reply.status(400).send({ error: 'La date de début doit précéder la fin.' })

    return prisma.piIteration.update({
      where: { id: iterationId },
      data: {
        ...(body.label !== undefined && { label: body.label.trim() }),
        startDate,
        endDate,
      },
    })
  })

  // ── Équipes du Train ────────────────────────────────────────────────────────

  app.post('/cycles/:id/teams', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const body = teamCreateSchema.parse(request.body)
    const max = await prisma.piCycleTeam.aggregate({ where: { cycleId: id }, _max: { order: true } })
    const team = await prisma.piCycleTeam.create({
      data: { cycleId: id, name: body.name.trim(), color: body.color ?? '#6366f1', order: (max._max.order ?? -1) + 1 },
    })
    return reply.status(201).send(team)
  })

  // Import depuis le pivot Team : copie nom/couleur (snapshot, référence lâche
  // sourceTeamId). L'appelant doit pouvoir voir chaque équipe importée.
  app.post('/cycles/:id/teams/import', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { teamIds } = z.object({ teamIds: z.array(z.string().min(1)).min(1).max(30) }).parse(request.body)
    const { role } = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })

    const existing = await prisma.piCycleTeam.findMany({ where: { cycleId: id }, select: { sourceTeamId: true, order: true } })
    const alreadyImported = new Set(existing.map((t) => t.sourceTeamId).filter(Boolean))
    let order = existing.reduce((m, t) => Math.max(m, t.order), -1) + 1

    let imported = 0
    for (const teamId of [...new Set(teamIds)]) {
      if (alreadyImported.has(teamId)) continue
      const team = await prisma.team.findUnique({ where: { id: teamId }, select: { ownerId: true, name: true, color: true } })
      if (!team) continue
      const teamRole = await resolveRole('team', teamId, userId, team.ownerId)
      if (!teamRole) return reply.status(403).send({ error: `Accès refusé à l'équipe ${team.name}.` })
      await prisma.piCycleTeam.create({
        data: { cycleId: id, name: team.name, color: team.color, sourceTeamId: teamId, order: order++ },
      })
      imported++
    }
    return { imported }
  })

  app.patch('/cycles/:id/teams/:teamId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, teamId } = request.params as { id: string; teamId: string }
    const { role } = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const existing = await prisma.piCycleTeam.findFirst({ where: { id: teamId, cycleId: id } })
    if (!existing) return reply.status(404).send({ error: 'Équipe introuvable.' })
    const body = teamUpdateSchema.parse(request.body)
    return prisma.piCycleTeam.update({
      where: { id: teamId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.color !== undefined && { color: body.color }),
        ...(body.order !== undefined && { order: body.order }),
      },
    })
  })

  app.delete('/cycles/:id/teams/:teamId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, teamId } = request.params as { id: string; teamId: string }
    const { role } = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const existing = await prisma.piCycleTeam.findFirst({ where: { id: teamId, cycleId: id } })
    if (!existing) return reply.status(404).send({ error: 'Équipe introuvable.' })
    await prisma.piCycleTeam.delete({ where: { id: teamId } })
    return reply.status(204).send()
  })

  // ── Intégration Formulaires : formulaire logistique ─────────────────────────

  // Crée le formulaire logistique dans le module Formulaires (owner = appelant),
  // publié, avec le template pré-rempli — puis le rattache au PI. Le RTE peut
  // ensuite l'éditer librement dans le builder Forms (questions supplémentaires).
  app.post('/cycles/:id/logistics-form', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const cycle = await prisma.piCycle.findUnique({ where: { id } })
    if (!cycle) return reply.status(404).send({ error: 'PI introuvable.' })
    const role = await resolveRole('pi', id, userId, cycle.ownerId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })

    if (cycle.logisticsFormId) {
      const existing = await prisma.form.findUnique({ where: { id: cycle.logisticsFormId }, select: { id: true } })
      if (existing) return reply.status(400).send({ error: 'Un formulaire logistique est déjà rattaché à ce PI.' })
    }

    const form = await prisma.form.create({
      data: {
        ownerId: userId,
        title: `Logistique ${cycle.name}`,
        description: 'Merci de confirmer votre présence et vos besoins pour le PI Planning.',
        fields: logisticsFields(cycle.eventDay1, cycle.eventDay2) as Prisma.InputJsonValue,
        isPublished: true,
        publicToken: crypto.randomBytes(9).toString('base64url'),
      },
    })
    await prisma.piCycle.update({ where: { id }, data: { logisticsFormId: form.id } })
    return reply.status(201).send({ formId: form.id, title: form.title })
  })

  // ── Intégration To-Do : tableau des tâches du Train ────────────────────────

  // Crée un TodoDashboard nommé d'après le PI (owner = appelant) et le lie.
  app.post('/cycles/:id/todo-dashboard', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const cycle = await prisma.piCycle.findUnique({ where: { id } })
    if (!cycle) return reply.status(404).send({ error: 'PI introuvable.' })
    const role = await resolveRole('pi', id, userId, cycle.ownerId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })

    if (cycle.todoDashboardId) {
      const existing = await prisma.todoDashboard.findUnique({ where: { id: cycle.todoDashboardId }, select: { id: true } })
      if (existing) return reply.status(400).send({ error: 'Un tableau de tâches est déjà rattaché à ce PI.' })
    }

    const dashboard = await prisma.todoDashboard.create({
      data: { ownerId: userId, name: `Tâches ${cycle.name}`, description: `Tableau des tâches du Train — ${cycle.name}` },
    })
    await prisma.piCycle.update({ where: { id }, data: { todoDashboardId: dashboard.id } })
    return reply.status(201).send({ dashboardId: dashboard.id, name: dashboard.name })
  })
}
