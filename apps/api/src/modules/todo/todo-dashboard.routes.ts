import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares, canManage } from '../../lib/module-share.js'

// TodoDashboard — regroupe plusieurs TodoList pour une vue consolidée avec
// rapports/statistiques. Le rôle sur le dashboard (OWNER/EDITOR/VIEWER, via
// ModuleShare module='tododashboard') donne un accès TRANSITIF aux listes
// rattachées (cf. todo.routes.ts::roleFor) — même pattern que Portfolio→Roadmap.

const dashboardCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
})
const dashboardUpdateSchema = dashboardCreateSchema.partial()

const PRIORITIES = ['NONE', 'LOW', 'MEDIUM', 'HIGH'] as const

export const todoDashboardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  async function roleFor(dashboardId: string, userId: string) {
    const db = await prisma.todoDashboard.findUnique({ where: { id: dashboardId }, select: { ownerId: true } })
    if (!db) return { role: null, ownerId: null }
    const role = await resolveRole('tododashboard', dashboardId, userId, db.ownerId)
    return { role, ownerId: db.ownerId }
  }

  // Liste : dashboards possédés + partagés.
  app.get('/dashboards', async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('tododashboard', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const dashboards = await prisma.todoDashboard.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      include: { _count: { select: { lists: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return dashboards.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      ownerId: d.ownerId,
      listCount: d._count.lists,
      role: d.ownerId === userId ? 'OWNER' : (sharedRole.get(d.id) ?? 'VIEWER'),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }))
  })

  // Détail : dashboard + listes rattachées (résumé, sans les items).
  app.get('/dashboards/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const dashboard = await prisma.todoDashboard.findUnique({
      where: { id },
      include: {
        lists: {
          orderBy: { updatedAt: 'desc' },
          include: { items: { select: { done: true } } },
        },
      },
    })
    if (!dashboard) return reply.status(404).send({ error: 'Tableau de bord introuvable.' })
    const role = await resolveRole('tododashboard', id, userId, dashboard.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé.' })
    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      ownerId: dashboard.ownerId,
      role,
      lists: dashboard.lists.map((l) => ({
        id: l.id, name: l.name, itemCount: l.items.length, doneCount: l.items.filter((i) => i.done).length,
      })),
      createdAt: dashboard.createdAt,
      updatedAt: dashboard.updatedAt,
    }
  })

  app.post('/dashboards', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = dashboardCreateSchema.parse(request.body)
    const dashboard = await prisma.todoDashboard.create({
      data: { name: body.name.trim(), description: body.description?.trim() || null, ownerId },
      include: { lists: true },
    })
    return reply.status(201).send({ ...dashboard, role: 'OWNER' })
  })

  app.patch('/dashboards/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé.' : 'Tableau de bord introuvable.' })
    const body = dashboardUpdateSchema.parse(request.body)
    const updated = await prisma.todoDashboard.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
      },
    })
    return { ...updated, role }
  })

  // Suppression — propriétaire uniquement. Les listes rattachées sont détachées
  // (dashboardId → null), jamais supprimées (onDelete: SetNull).
  app.delete('/dashboards/:id', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const dashboard = await prisma.todoDashboard.findFirst({ where: { id, ownerId } })
    if (!dashboard) return reply.status(404).send({ error: 'Tableau de bord introuvable.' })
    await prisma.todoDashboard.delete({ where: { id } })
    await deleteResourceShares('tododashboard', id)
    return reply.status(204).send()
  })

  // ── Rattachement de listes ──────────────────────────────────────────────────

  // Rattache une liste existante — il faut pouvoir éditer le dashboard ET la
  // liste (sinon on pourrait exposer une liste privée d'un tiers via un
  // dashboard qu'on contrôle).
  app.post('/dashboards/:id/lists', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { listId } = z.object({ listId: z.string().min(1) }).parse(request.body)
    const { role: dbRole } = await roleFor(id, userId)
    if (!canManage(dbRole)) return reply.status(dbRole ? 403 : 404).send({ error: dbRole ? 'Accès refusé au tableau de bord.' : 'Tableau de bord introuvable.' })
    const list = await prisma.todoList.findUnique({ where: { id: listId }, select: { ownerId: true } })
    if (!list) return reply.status(404).send({ error: 'Liste introuvable.' })
    const listRole = await resolveRole('todolist', listId, userId, list.ownerId)
    if (!canManage(listRole)) return reply.status(403).send({ error: 'Accès refusé à cette liste.' })
    await prisma.todoList.update({ where: { id: listId }, data: { dashboardId: id } })
    return reply.status(204).send()
  })

  // Détache — même garde que le rattachement.
  app.delete('/dashboards/:id/lists/:listId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, listId } = request.params as { id: string; listId: string }
    const { role: dbRole } = await roleFor(id, userId)
    if (!canManage(dbRole)) return reply.status(dbRole ? 403 : 404).send({ error: dbRole ? 'Accès refusé au tableau de bord.' : 'Tableau de bord introuvable.' })
    const list = await prisma.todoList.findFirst({ where: { id: listId, dashboardId: id } })
    if (!list) return reply.status(404).send({ error: 'Liste introuvable dans ce tableau de bord.' })
    await prisma.todoList.update({ where: { id: listId }, data: { dashboardId: null } })
    return reply.status(204).send()
  })

  // ── Rapports / statistiques ──────────────────────────────────────────────────

  // Calculé à la volée sur les listes rattachées — aucun champ dénormalisé.
  app.get('/dashboards/:id/stats', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const dashboard = await prisma.todoDashboard.findUnique({ where: { id }, select: { ownerId: true } })
    if (!dashboard) return reply.status(404).send({ error: 'Tableau de bord introuvable.' })
    const role = await resolveRole('tododashboard', id, userId, dashboard.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé.' })

    const lists = await prisma.todoList.findMany({
      where: { dashboardId: id },
      include: { items: true },
    })

    const today = new Date().toISOString().slice(0, 10)
    const byList = lists.map((l) => {
      const itemCount = l.items.length
      const doneCount = l.items.filter((i) => i.done).length
      const overdueCount = l.items.filter((i) => !i.done && i.dueDate && i.dueDate < today).length
      return {
        id: l.id,
        name: l.name,
        itemCount,
        doneCount,
        completionPercent: itemCount > 0 ? Math.round((doneCount / itemCount) * 100) : 0,
        overdueCount,
      }
    })

    const allItems = lists.flatMap((l) => l.items.map((i) => ({ ...i, listName: l.name })))
    const totalItems = allItems.length
    const totalDone = allItems.filter((i) => i.done).length
    const totalOverdue = allItems.filter((i) => !i.done && i.dueDate && i.dueDate < today).length

    const byPriority = Object.fromEntries(
      PRIORITIES.map((p) => [p, allItems.filter((i) => !i.done && i.priority === p).length]),
    ) as Record<(typeof PRIORITIES)[number], number>

    const recentlyCompleted = allItems
      .filter((i) => i.done)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 5)
      .map((i) => ({ id: i.id, title: i.title, listName: i.listName, completedAt: i.updatedAt }))

    return {
      byList,
      totalItems,
      totalDone,
      completionPercent: totalItems > 0 ? Math.round((totalDone / totalItems) * 100) : 0,
      totalOverdue,
      byPriority,
      recentlyCompleted,
    }
  })
}
