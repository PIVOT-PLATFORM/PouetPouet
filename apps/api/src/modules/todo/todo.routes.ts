import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares, bestRole, type ModuleRole } from '../../lib/module-share.js'
import { sortTodoItems } from './todo-sort.js'

// Listes de tâches — partageables par rôle (ModuleShare module='todolist').
// Rattachée à un TodoDashboard (dashboardId), une liste devient aussi accessible
// via le rôle transitif du dashboard (cf. roleFor) — un partage sur le dashboard
// suffit, pas besoin de partager chaque liste individuellement (même pattern
// que Portfolio → Roadmap).

const PRIORITIES = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format yyyy-mm-dd')

const listCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
})
const listUpdateSchema = listCreateSchema.partial()

const itemCreateSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(3000).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: ISO_DATE.nullable().optional(),
})
const itemUpdateSchema = itemCreateSchema.partial().extend({
  done: z.boolean().optional(),
})

export const todoRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // Rôle effectif sur une liste : direct (owner/partage) combiné au rôle
  // transitif hérité du TodoDashboard parent, si rattachée.
  async function roleFor(listId: string, userId: string): Promise<{ role: ModuleRole | null; ownerId: string | null; dashboardId: string | null }> {
    const list = await prisma.todoList.findUnique({ where: { id: listId }, select: { ownerId: true, dashboardId: true } })
    if (!list) return { role: null, ownerId: null, dashboardId: null }
    const direct = await resolveRole('todolist', listId, userId, list.ownerId)
    let via: ModuleRole | null = null
    if (list.dashboardId) {
      const dashboard = await prisma.todoDashboard.findUnique({ where: { id: list.dashboardId }, select: { ownerId: true } })
      if (dashboard) via = await resolveRole('tododashboard', list.dashboardId, userId, dashboard.ownerId)
    }
    return { role: bestRole(direct, via), ownerId: list.ownerId, dashboardId: list.dashboardId }
  }

  // GET /lists — possédées, partagées directement, ou accessibles via un
  // dashboard partagé (accès transitif) ; filtres ?mine= / ?favorite=.
  app.get('/lists', async (request) => {
    const { id: userId } = request.user as { id: string }
    const query = request.query as { mine?: string; favorite?: string }

    const sharedLists = await sharedResourceIds('todolist', userId)
    const sharedListRole = new Map(sharedLists.map((s) => [s.id, s.role]))
    const sharedDashboards = await sharedResourceIds('tododashboard', userId)
    const sharedDashboardRole = new Map(sharedDashboards.map((s) => [s.id, s.role]))
    const myDashboards = await prisma.todoDashboard.findMany({ where: { ownerId: userId }, select: { id: true } })
    const accessibleDashboardIds = [...new Set([...sharedDashboardRole.keys(), ...myDashboards.map((d) => d.id)])]

    const AND: Record<string, unknown>[] = [
      {
        OR: [
          { ownerId: userId },
          { id: { in: sharedLists.map((s) => s.id) } },
          ...(accessibleDashboardIds.length ? [{ dashboardId: { in: accessibleDashboardIds } }] : []),
        ],
      },
    ]
    if (query.mine === 'true') AND.push({ ownerId: userId })
    if (query.favorite === 'true') AND.push({ favorites: { some: { userId } } })

    const lists = await prisma.todoList.findMany({
      where: { AND },
      include: {
        items: { select: { done: true } },
        favorites: { where: { userId }, select: { id: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const myDashboardIds = new Set(myDashboards.map((d) => d.id))
    return lists.map((l) => {
      const direct: ModuleRole | null = l.ownerId === userId ? 'OWNER' : (sharedListRole.get(l.id) ?? null)
      const via: ModuleRole | null = l.dashboardId ? (myDashboardIds.has(l.dashboardId) ? 'OWNER' : (sharedDashboardRole.get(l.dashboardId) ?? null)) : null
      return {
        id: l.id,
        name: l.name,
        description: l.description,
        ownerId: l.ownerId,
        dashboardId: l.dashboardId,
        itemCount: l.items.length,
        doneCount: l.items.filter((i) => i.done).length,
        isFavorite: l.favorites.length > 0,
        role: bestRole(direct, via) ?? 'VIEWER',
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      }
    })
  })

  // GET /lists/:id — détail + items triés (non faits d'abord, priorité, échéance).
  app.get('/lists/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const list = await prisma.todoList.findUnique({
      where: { id },
      include: { items: true, favorites: { where: { userId }, select: { id: true } } },
    })
    if (!list) return reply.status(404).send({ error: 'Liste introuvable.' })
    const { role } = await roleFor(id, userId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé.' })
    return {
      id: list.id,
      name: list.name,
      description: list.description,
      ownerId: list.ownerId,
      dashboardId: list.dashboardId,
      items: sortTodoItems(list.items),
      isFavorite: list.favorites.length > 0,
      role,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    }
  })

  app.post('/lists', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = listCreateSchema.parse(request.body)
    const list = await prisma.todoList.create({
      data: { name: body.name.trim(), description: body.description?.trim() || null, ownerId },
      include: { items: true },
    })
    return reply.status(201).send({ ...list, isFavorite: false, role: 'OWNER' })
  })

  app.patch('/lists/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'Liste introuvable.' })
    const body = listUpdateSchema.parse(request.body)
    const updated = await prisma.todoList.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
      },
      include: { items: true },
    })
    return { ...updated, role }
  })

  // Suppression — propriétaire uniquement (+ nettoyage des partages).
  app.delete('/lists/:id', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const list = await prisma.todoList.findFirst({ where: { id, ownerId } })
    if (!list) return reply.status(404).send({ error: 'Liste introuvable.' })
    await prisma.todoList.delete({ where: { id } })
    await deleteResourceShares('todolist', id)
    return reply.status(204).send()
  })

  // POST /lists/:id/favorite — toggle (tout utilisateur pouvant voir la liste).
  app.post('/lists/:id/favorite', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id: listId } = request.params as { id: string }
    const { role } = await roleFor(listId, userId)
    if (!role) return reply.status(404).send({ error: 'Liste introuvable.' })

    const alreadyFavorite = await prisma.todoListFavorite.findUnique({
      where: { listId_userId: { listId, userId } },
    })
    let isFavorite: boolean
    if (alreadyFavorite) {
      await prisma.todoListFavorite.delete({ where: { listId_userId: { listId, userId } } })
      isFavorite = false
    } else {
      await prisma.todoListFavorite.create({ data: { listId, userId } })
      isFavorite = true
    }
    return reply.send({ isFavorite })
  })

  // ── Items ─────────────────────────────────────────────────────────────────────

  app.post('/lists/:id/items', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'Liste introuvable.' })
    const body = itemCreateSchema.parse(request.body)

    const max = await prisma.todoItem.aggregate({ where: { listId: id }, _max: { order: true } })
    const item = await prisma.todoItem.create({
      data: {
        listId: id,
        title: body.title.trim(),
        notes: body.notes?.trim() || null,
        priority: body.priority ?? 'NONE',
        dueDate: body.dueDate || null,
        order: (max._max.order ?? -1) + 1,
      },
    })
    await prisma.todoList.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.status(201).send(item)
  })

  app.patch('/lists/:id/items/:itemId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, itemId } = request.params as { id: string; itemId: string }
    const { role } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'Liste introuvable.' })
    const existing = await prisma.todoItem.findFirst({ where: { id: itemId, listId: id } })
    if (!existing) return reply.status(404).send({ error: 'Tâche introuvable.' })
    const body = itemUpdateSchema.parse(request.body)

    const item = await prisma.todoItem.update({
      where: { id: itemId },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.notes !== undefined && { notes: body.notes?.trim() || null }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.dueDate !== undefined && { dueDate: body.dueDate || null }),
        ...(body.done !== undefined && { done: body.done }),
      },
    })
    await prisma.todoList.update({ where: { id }, data: { updatedAt: new Date() } })
    return item
  })

  app.delete('/lists/:id/items/:itemId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, itemId } = request.params as { id: string; itemId: string }
    const { role } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'Liste introuvable.' })
    const existing = await prisma.todoItem.findFirst({ where: { id: itemId, listId: id } })
    if (!existing) return reply.status(404).send({ error: 'Tâche introuvable.' })
    await prisma.todoItem.delete({ where: { id: itemId } })
    await prisma.todoList.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.status(204).send()
  })
}
