import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, canManage } from '../../lib/module-share.js'

// Program Board — matrice équipes × itérations d'un PI. Tickets typés (Feature,
// Milestone, Risque, Objectif, Story, Enabler) positionnés dans les cellules
// (teamId null = ligne Train, iterationId null = colonne « Non planifié »).
// Dépendances fournisseur → demandeur avec statut visuel OK/BLOCKED, validées
// sans cycle (adaptation de validateDeps du module Roadmap).

const TICKET_TYPES = ['FEATURE', 'MILESTONE', 'RISK', 'OBJECTIVE', 'STORY', 'ENABLER'] as const
const DEP_STATUSES = ['OK', 'BLOCKED'] as const

const ticketCreateSchema = z.object({
  type: z.enum(TICKET_TYPES),
  title: z.string().min(1).max(300),
  description: z.string().max(3000).nullable().optional(),
  teamId: z.string().nullable().optional(),
  iterationId: z.string().nullable().optional(),
})
const ticketUpdateSchema = ticketCreateSchema.partial().extend({
  order: z.number().int().min(0).optional(),
})

const dependencyCreateSchema = z.object({
  fromTicketId: z.string().min(1),
  toTicketId: z.string().min(1),
  status: z.enum(DEP_STATUSES).optional(),
  note: z.string().max(1000).nullable().optional(),
})
const dependencyUpdateSchema = z.object({
  status: z.enum(DEP_STATUSES).optional(),
  note: z.string().max(1000).nullable().optional(),
})

// Ajouter l'arête from→to crée-t-elle une boucle ? Oui si `from` est déjà
// atteignable depuis `to` en suivant les arêtes existantes (parcours du graphe
// des dépendances, même approche que reachesItem du module Roadmap).
export function wouldCreateDependencyCycle(edges: { fromTicketId: string; toTicketId: string }[], fromId: string, toId: string): boolean {
  const adjacency = new Map<string, string[]>()
  for (const e of edges) {
    const list = adjacency.get(e.fromTicketId) ?? []
    list.push(e.toTicketId)
    adjacency.set(e.fromTicketId, list)
  }
  const visited = new Set<string>()
  const reachesFrom = (nodeId: string): boolean => {
    if (nodeId === fromId) return true
    if (visited.has(nodeId)) return false
    visited.add(nodeId)
    return (adjacency.get(nodeId) ?? []).some(reachesFrom)
  }
  return reachesFrom(toId)
}

export const piBoardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  async function roleFor(cycleId: string, userId: string) {
    const cycle = await prisma.piCycle.findUnique({ where: { id: cycleId }, select: { ownerId: true } })
    if (!cycle) return null
    return resolveRole('pi', cycleId, userId, cycle.ownerId)
  }

  // Vérifie que la cellule cible (équipe, itération) appartient bien au cycle.
  async function validateCell(cycleId: string, teamId: string | null | undefined, iterationId: string | null | undefined): Promise<string | null> {
    if (teamId) {
      const team = await prisma.piCycleTeam.findFirst({ where: { id: teamId, cycleId }, select: { id: true } })
      if (!team) return 'Équipe inconnue dans ce PI.'
    }
    if (iterationId) {
      const iteration = await prisma.piIteration.findFirst({ where: { id: iterationId, cycleId }, select: { id: true } })
      if (!iteration) return 'Itération inconnue dans ce PI.'
    }
    return null
  }

  // ── Board complet (payload unique) ─────────────────────────────────────────

  app.get('/cycles/:id/board', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const cycle = await prisma.piCycle.findUnique({
      where: { id },
      include: {
        iterations: { orderBy: { number: 'asc' } },
        teams: { orderBy: { order: 'asc' } },
        tickets: { orderBy: { order: 'asc' } },
        dependencies: true,
      },
    })
    if (!cycle) return reply.status(404).send({ error: 'PI introuvable.' })
    const role = await resolveRole('pi', id, userId, cycle.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé.' })
    return {
      id: cycle.id,
      name: cycle.name,
      status: cycle.status,
      iterations: cycle.iterations,
      teams: cycle.teams,
      tickets: cycle.tickets,
      dependencies: cycle.dependencies,
      role,
    }
  })

  // ── Tickets ────────────────────────────────────────────────────────────────

  app.post('/cycles/:id/tickets', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const role = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const body = ticketCreateSchema.parse(request.body)
    const cellError = await validateCell(id, body.teamId, body.iterationId)
    if (cellError) return reply.status(400).send({ error: cellError })

    const max = await prisma.piTicket.aggregate({
      where: { cycleId: id, teamId: body.teamId ?? null, iterationId: body.iterationId ?? null },
      _max: { order: true },
    })
    const ticket = await prisma.piTicket.create({
      data: {
        cycleId: id,
        type: body.type,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        teamId: body.teamId ?? null,
        iterationId: body.iterationId ?? null,
        order: (max._max.order ?? -1) + 1,
      },
    })
    return reply.status(201).send(ticket)
  })

  app.patch('/cycles/:id/tickets/:ticketId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, ticketId } = request.params as { id: string; ticketId: string }
    const role = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const existing = await prisma.piTicket.findFirst({ where: { id: ticketId, cycleId: id } })
    if (!existing) return reply.status(404).send({ error: 'Ticket introuvable.' })
    const body = ticketUpdateSchema.parse(request.body)
    const cellError = await validateCell(id, body.teamId, body.iterationId)
    if (cellError) return reply.status(400).send({ error: cellError })

    return prisma.piTicket.update({
      where: { id: ticketId },
      data: {
        ...(body.type !== undefined && { type: body.type }),
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
        ...(body.teamId !== undefined && { teamId: body.teamId }),
        ...(body.iterationId !== undefined && { iterationId: body.iterationId }),
        ...(body.order !== undefined && { order: body.order }),
      },
    })
  })

  app.delete('/cycles/:id/tickets/:ticketId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, ticketId } = request.params as { id: string; ticketId: string }
    const role = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const existing = await prisma.piTicket.findFirst({ where: { id: ticketId, cycleId: id } })
    if (!existing) return reply.status(404).send({ error: 'Ticket introuvable.' })
    await prisma.piTicket.delete({ where: { id: ticketId } }) // dépendances liées supprimées en cascade
    return reply.status(204).send()
  })

  // ── Dépendances ────────────────────────────────────────────────────────────

  app.post('/cycles/:id/dependencies', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const role = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const body = dependencyCreateSchema.parse(request.body)

    if (body.fromTicketId === body.toTicketId) return reply.status(400).send({ error: 'Un ticket ne peut pas dépendre de lui-même.' })
    const tickets = await prisma.piTicket.findMany({ where: { cycleId: id, id: { in: [body.fromTicketId, body.toTicketId] } }, select: { id: true } })
    if (tickets.length !== 2) return reply.status(400).send({ error: 'Les deux tickets doivent appartenir à ce PI.' })

    const duplicate = await prisma.piDependency.findUnique({
      where: { fromTicketId_toTicketId: { fromTicketId: body.fromTicketId, toTicketId: body.toTicketId } },
    })
    if (duplicate) return reply.status(400).send({ error: 'Cette dépendance existe déjà.' })

    const edges = await prisma.piDependency.findMany({ where: { cycleId: id }, select: { fromTicketId: true, toTicketId: true } })
    if (wouldCreateDependencyCycle(edges, body.fromTicketId, body.toTicketId)) {
      return reply.status(400).send({ error: 'Cette dépendance créerait une boucle (cycle).' })
    }

    const dependency = await prisma.piDependency.create({
      data: {
        cycleId: id,
        fromTicketId: body.fromTicketId,
        toTicketId: body.toTicketId,
        status: body.status ?? 'OK',
        note: body.note?.trim() || null,
      },
    })
    return reply.status(201).send(dependency)
  })

  app.patch('/cycles/:id/dependencies/:depId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, depId } = request.params as { id: string; depId: string }
    const role = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const existing = await prisma.piDependency.findFirst({ where: { id: depId, cycleId: id } })
    if (!existing) return reply.status(404).send({ error: 'Dépendance introuvable.' })
    const body = dependencyUpdateSchema.parse(request.body)
    return prisma.piDependency.update({
      where: { id: depId },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.note !== undefined && { note: body.note?.trim() || null }),
      },
    })
  })

  app.delete('/cycles/:id/dependencies/:depId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, depId } = request.params as { id: string; depId: string }
    const role = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'PI introuvable.' })
    const existing = await prisma.piDependency.findFirst({ where: { id: depId, cycleId: id } })
    if (!existing) return reply.status(404).send({ error: 'Dépendance introuvable.' })
    await prisma.piDependency.delete({ where: { id: depId } })
    return reply.status(204).send()
  })
}
