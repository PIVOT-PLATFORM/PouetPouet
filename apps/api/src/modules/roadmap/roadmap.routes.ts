import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares } from '../../lib/module-share.js'

// Roadmap — planification visuelle façon Gantt. Multi-roadmaps par utilisateur,
// partageables par rôle (ModuleShare module='roadmap'). Pas de temps réel :
// chaque modification persiste via REST. OWNER/EDITOR éditent, VIEWER lit,
// seul le propriétaire supprime et gère les partages.

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format yyyy-mm-dd')
const SCALE = z.enum(['week', 'month', 'quarter', 'semester', 'year'])
const RISK = z.enum(['low', 'med', 'high'])
const PRIO = z.enum(['should', 'must'])
const CATEGORY = z.enum(['infra', 'dev', 'cyber'])

const roadmapCreateSchema = z.object({
  name: z.string().min(1).max(120),
  startDate: ISO_DATE,
  endDate: ISO_DATE,
  scale: SCALE.optional(),
})

const roadmapUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  startDate: ISO_DATE.optional(),
  endDate: ISO_DATE.optional(),
  scale: SCALE.optional(),
})

const itemCreateSchema = z.object({
  name: z.string().min(1).max(200),
  startDate: ISO_DATE,
  endDate: ISO_DATE,
  biz: z.string().max(2000).optional(),
  risk: RISK.optional(),
  prio: PRIO.optional(),
  categories: z.array(CATEGORY).optional(),
  deps: z.array(z.string()).optional(),
})

const itemUpdateSchema = itemCreateSchema.partial()

const reorderSchema = z.object({ order: z.array(z.string()) })

export const roadmapRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // Rôle effectif sur un roadmap, ou null si pas d'accès.
  async function roleFor(roadmapId: string, userId: string): Promise<{ role: 'OWNER' | 'EDITOR' | 'VIEWER' | null; ownerId: string | null }> {
    const rm = await prisma.roadmap.findUnique({ where: { id: roadmapId }, select: { ownerId: true } })
    if (!rm) return { role: null, ownerId: null }
    const role = await resolveRole('roadmap', roadmapId, userId, rm.ownerId)
    return { role, ownerId: rm.ownerId }
  }

  // ── Roadmaps ──────────────────────────────────────────────────────────────────

  // Liste : roadmaps possédés + partagés, chacun annoté de son rôle + nb d'items.
  app.get('/', async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('roadmap', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const roadmaps = await prisma.roadmap.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      include: { _count: { select: { items: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return roadmaps.map((r) => ({
      id: r.id,
      name: r.name,
      ownerId: r.ownerId,
      startDate: r.startDate,
      endDate: r.endDate,
      scale: r.scale,
      itemCount: r._count.items,
      role: r.ownerId === userId ? 'OWNER' : (sharedRole.get(r.id) ?? 'VIEWER'),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
  })

  // Détail : roadmap + items ordonnés. Lecture ouverte à tout rôle (y compris VIEWER).
  app.get('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const roadmap = await prisma.roadmap.findUnique({
      where: { id },
      include: { items: { orderBy: { order: 'asc' } } },
    })
    if (!roadmap) return reply.status(404).send({ error: 'Roadmap introuvable' })
    const role = await resolveRole('roadmap', id, userId, roadmap.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    return { ...roadmap, role }
  })

  // Création — tout utilisateur authentifié crée ses propres roadmaps.
  app.post('/', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = roadmapCreateSchema.parse(request.body)
    if (body.startDate > body.endDate) return reply.status(400).send({ error: 'La date de début doit précéder la fin' })
    const roadmap = await prisma.roadmap.create({
      data: { name: body.name.trim(), ownerId, startDate: body.startDate, endDate: body.endDate, scale: body.scale ?? 'quarter' },
      include: { items: true },
    })
    return reply.status(201).send({ ...roadmap, role: 'OWNER' })
  })

  // Mise à jour des métadonnées — OWNER/EDITOR.
  app.patch('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Roadmap introuvable' })
    const body = roadmapUpdateSchema.parse(request.body)
    const updated = await prisma.roadmap.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.startDate !== undefined && { startDate: body.startDate }),
        ...(body.endDate !== undefined && { endDate: body.endDate }),
        ...(body.scale !== undefined && { scale: body.scale }),
      },
      include: { items: { orderBy: { order: 'asc' } } },
    })
    return { ...updated, role }
  })

  // Suppression — propriétaire uniquement (+ nettoyage des partages).
  app.delete('/:id', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const roadmap = await prisma.roadmap.findFirst({ where: { id, ownerId } })
    if (!roadmap) return reply.status(404).send({ error: 'Roadmap introuvable' })
    await prisma.roadmap.delete({ where: { id } })
    await deleteResourceShares('roadmap', id)
    return reply.status(204).send()
  })

  // ── Items ─────────────────────────────────────────────────────────────────────

  app.post('/:id/items', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Roadmap introuvable' })
    const body = itemCreateSchema.parse(request.body)
    if (body.startDate > body.endDate) return reply.status(400).send({ error: 'La date de début doit précéder la fin' })
    const max = await prisma.roadmapItem.aggregate({ where: { roadmapId: id }, _max: { order: true } })
    const item = await prisma.roadmapItem.create({
      data: {
        roadmapId: id,
        name: body.name.trim(),
        startDate: body.startDate,
        endDate: body.endDate,
        biz: body.biz?.trim() || null,
        risk: body.risk ?? 'med',
        prio: body.prio ?? 'should',
        categories: body.categories ?? ['dev'],
        deps: body.deps ?? [],
        order: (max._max.order ?? -1) + 1,
      },
    })
    await prisma.roadmap.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.status(201).send(item)
  })

  app.patch('/:id/items/:itemId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, itemId } = request.params as { id: string; itemId: string }
    const { role } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Roadmap introuvable' })
    const existing = await prisma.roadmapItem.findFirst({ where: { id: itemId, roadmapId: id } })
    if (!existing) return reply.status(404).send({ error: 'Item introuvable' })
    const body = itemUpdateSchema.parse(request.body)
    const startDate = body.startDate ?? existing.startDate
    const endDate = body.endDate ?? existing.endDate
    if (startDate > endDate) return reply.status(400).send({ error: 'La date de début doit précéder la fin' })
    const item = await prisma.roadmapItem.update({
      where: { id: itemId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.startDate !== undefined && { startDate: body.startDate }),
        ...(body.endDate !== undefined && { endDate: body.endDate }),
        ...(body.biz !== undefined && { biz: body.biz?.trim() || null }),
        ...(body.risk !== undefined && { risk: body.risk }),
        ...(body.prio !== undefined && { prio: body.prio }),
        ...(body.categories !== undefined && { categories: body.categories }),
        ...(body.deps !== undefined && { deps: body.deps }),
      },
    })
    await prisma.roadmap.update({ where: { id }, data: { updatedAt: new Date() } })
    return item
  })

  app.delete('/:id/items/:itemId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, itemId } = request.params as { id: string; itemId: string }
    const { role } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Roadmap introuvable' })
    const existing = await prisma.roadmapItem.findFirst({ where: { id: itemId, roadmapId: id } })
    if (!existing) return reply.status(404).send({ error: 'Item introuvable' })
    await prisma.roadmapItem.delete({ where: { id: itemId } })
    // Retirer cet item des dépendances des autres items du même roadmap.
    const dependents = await prisma.roadmapItem.findMany({ where: { roadmapId: id, deps: { has: itemId } }, select: { id: true, deps: true } })
    await Promise.all(
      dependents.map((d) =>
        prisma.roadmapItem.update({ where: { id: d.id }, data: { deps: d.deps.filter((x) => x !== itemId) } }),
      ),
    )
    await prisma.roadmap.update({ where: { id }, data: { updatedAt: new Date() } })
    return reply.status(204).send()
  })

  // Réordonnancement — liste d'ids dans le nouvel ordre.
  app.put('/:id/items/order', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Roadmap introuvable' })
    const { order } = reorderSchema.parse(request.body)
    const items = await prisma.roadmapItem.findMany({ where: { roadmapId: id }, select: { id: true } })
    const valid = new Set(items.map((i) => i.id))
    await prisma.$transaction(
      order.filter((itemId) => valid.has(itemId)).map((itemId, index) =>
        prisma.roadmapItem.update({ where: { id: itemId }, data: { order: index } }),
      ),
    )
    return reply.send({ ok: true })
  })
}
