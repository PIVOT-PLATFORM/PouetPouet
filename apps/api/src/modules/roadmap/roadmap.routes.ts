import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares, bestRole, type ModuleRole } from '../../lib/module-share.js'

// Roadmap — planification visuelle façon Gantt. Multi-roadmaps par utilisateur,
// partageables par rôle (ModuleShare module='roadmap'). Pas de temps réel :
// chaque modification persiste via REST. OWNER/EDITOR éditent, VIEWER lit,
// seul le propriétaire supprime et gère les partages.
//
// Rattachée à un Portfolio (portfolioId), une roadmap devient aussi accessible
// via le rôle transitif du portfolio (cf. resolveRoadmapRole) — un partage sur
// le portfolio suffit, pas besoin de partager chaque roadmap individuellement.

const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format yyyy-mm-dd')
const SCALE = z.enum(['week', 'month', 'quarter', 'semester', 'year'])
const RISK = z.enum(['low', 'med', 'high'])
const PRIO = z.enum(['should', 'must'])
const CATEGORY = z.enum(['infra', 'dev', 'cyber'])
const STATUS = z.enum(['TODO', 'DOING', 'BLOCKED', 'DONE'])

const roadmapCreateSchema = z.object({
  name: z.string().min(1).max(120),
  startDate: ISO_DATE,
  endDate: ISO_DATE,
  scale: SCALE.optional(),
  portfolioId: z.string().nullable().optional(),
})

const roadmapUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  startDate: ISO_DATE.optional(),
  endDate: ISO_DATE.optional(),
  scale: SCALE.optional(),
  portfolioId: z.string().nullable().optional(),
})

const itemCreateSchema = z.object({
  name: z.string().min(1).max(200),
  startDate: ISO_DATE,
  endDate: ISO_DATE,
  biz: z.string().max(2000).optional(),
  risk: RISK.optional(),
  prio: PRIO.optional(),
  status: STATUS.optional(),
  assigneeId: z.string().nullable().optional(),
  categories: z.array(CATEGORY).optional(),
  deps: z.array(z.string()).optional(),
})

const itemUpdateSchema = itemCreateSchema.partial()

const reorderSchema = z.object({ order: z.array(z.string()) })

export const roadmapRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // Rôle effectif sur un roadmap : direct (owner/partage) combiné au rôle
  // transitif hérité du Portfolio parent, si rattaché (cf. bestRole).
  async function roleFor(roadmapId: string, userId: string): Promise<{ role: ModuleRole | null; ownerId: string | null; portfolioId: string | null }> {
    const rm = await prisma.roadmap.findUnique({ where: { id: roadmapId }, select: { ownerId: true, portfolioId: true } })
    if (!rm) return { role: null, ownerId: null, portfolioId: null }
    const direct = await resolveRole('roadmap', roadmapId, userId, rm.ownerId)
    let via: ModuleRole | null = null
    if (rm.portfolioId) {
      const pf = await prisma.portfolio.findUnique({ where: { id: rm.portfolioId }, select: { ownerId: true } })
      if (pf) via = await resolveRole('portfolio', rm.portfolioId, userId, pf.ownerId)
    }
    return { role: bestRole(direct, via), ownerId: rm.ownerId, portfolioId: rm.portfolioId }
  }

  // Un id de portfolio est-il valide ET accessible en édition par ce user ?
  // (rattacher une roadmap à un portfolio qu'on ne peut pas éditer serait une
  // fuite de contrôle d'accès — on l'interdit explicitement.)
  async function assertPortfolioEditable(portfolioId: string, userId: string, reply: { status: (c: number) => { send: (b: unknown) => unknown } }): Promise<boolean> {
    const pf = await prisma.portfolio.findUnique({ where: { id: portfolioId }, select: { ownerId: true } })
    if (!pf) { reply.status(404).send({ error: 'Portefeuille introuvable.' }); return false }
    const role = await resolveRole('portfolio', portfolioId, userId, pf.ownerId)
    if (role !== 'OWNER' && role !== 'EDITOR') { reply.status(403).send({ error: 'Accès refusé au portefeuille.' }); return false }
    return true
  }

  // ── Roadmaps ──────────────────────────────────────────────────────────────────

  // Liste : roadmaps possédés + partagés directement + accessibles via un
  // portfolio partagé (transitif), chacun annoté de son rôle + nb d'items.
  app.get('/', async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('roadmap', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const sharedPortfolios = await sharedResourceIds('portfolio', userId)
    const portfolioRole = new Map(sharedPortfolios.map((s) => [s.id, s.role]))
    const myPortfolios = await prisma.portfolio.findMany({ where: { ownerId: userId }, select: { id: true } })
    const accessiblePortfolioIds = [...new Set([...portfolioRole.keys(), ...myPortfolios.map((p) => p.id)])]

    const roadmaps = await prisma.roadmap.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { id: { in: shared.map((s) => s.id) } },
          ...(accessiblePortfolioIds.length ? [{ portfolioId: { in: accessiblePortfolioIds } }] : []),
        ],
      },
      include: { _count: { select: { items: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    const myPortfolioIds = new Set(myPortfolios.map((p) => p.id))
    return roadmaps.map((r) => {
      const direct: ModuleRole | null = r.ownerId === userId ? 'OWNER' : (sharedRole.get(r.id) ?? null)
      const via: ModuleRole | null = r.portfolioId ? (myPortfolioIds.has(r.portfolioId) ? 'OWNER' : (portfolioRole.get(r.portfolioId) ?? null)) : null
      return {
        id: r.id,
        name: r.name,
        ownerId: r.ownerId,
        portfolioId: r.portfolioId,
        startDate: r.startDate,
        endDate: r.endDate,
        scale: r.scale,
        itemCount: r._count.items,
        role: bestRole(direct, via) ?? 'VIEWER',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }
    })
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
    const { role } = await roleFor(id, userId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    return { ...roadmap, role }
  })

  // Création — tout utilisateur authentifié crée ses propres roadmaps.
  app.post('/', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = roadmapCreateSchema.parse(request.body)
    if (body.startDate > body.endDate) return reply.status(400).send({ error: 'La date de début doit précéder la fin' })
    if (body.portfolioId && !(await assertPortfolioEditable(body.portfolioId, ownerId, reply))) return
    const roadmap = await prisma.roadmap.create({
      data: {
        name: body.name.trim(),
        ownerId,
        startDate: body.startDate,
        endDate: body.endDate,
        scale: body.scale ?? 'quarter',
        portfolioId: body.portfolioId ?? null,
      },
      include: { items: true },
    })
    return reply.status(201).send({ ...roadmap, role: 'OWNER' })
  })

  // Mise à jour des métadonnées — OWNER/EDITOR (direct ou via portfolio).
  app.patch('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Roadmap introuvable' })
    const body = roadmapUpdateSchema.parse(request.body)
    if (body.portfolioId && !(await assertPortfolioEditable(body.portfolioId, userId, reply))) return
    const updated = await prisma.roadmap.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.startDate !== undefined && { startDate: body.startDate }),
        ...(body.endDate !== undefined && { endDate: body.endDate }),
        ...(body.scale !== undefined && { scale: body.scale }),
        ...(body.portfolioId !== undefined && { portfolioId: body.portfolioId }),
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

  // Un dep-set est-il valide ? ids existants du même roadmap, pas d'auto-référence,
  // pas de cycle (aucun des deps ne doit pouvoir remonter jusqu'à itemId).
  function validateDeps(itemId: string | null, deps: string[], allItems: { id: string; deps: string[] }[]): string | null {
    if (itemId && deps.includes(itemId)) return 'Un item ne peut pas dépendre de lui-même.'
    const known = new Set(allItems.map((i) => i.id))
    const unknown = deps.find((d) => !known.has(d))
    if (unknown) return `Dépendance inconnue dans ce roadmap : ${unknown}.`
    if (itemId) {
      const depsMap = new Map(allItems.map((i) => [i.id, i.deps]))
      const visited = new Set<string>()
      const reachesItem = (nodeId: string): boolean => {
        if (nodeId === itemId) return true
        if (visited.has(nodeId)) return false
        visited.add(nodeId)
        return (depsMap.get(nodeId) ?? []).some(reachesItem)
      }
      if (deps.some(reachesItem)) return 'Cette dépendance créerait une boucle (cycle).'
    }
    return null
  }

  // L'assigné (s'il est fourni) doit avoir accès au roadmap (owner ou partagé,
  // direct ou via portfolio) — on n'assigne pas quelqu'un qui ne peut pas voir l'item.
  async function validateAssignee(assigneeId: string | null | undefined, roadmapId: string, roadmapOwnerId: string, portfolioId: string | null): Promise<string | null> {
    if (!assigneeId) return null
    const { role } = await (async () => {
      const direct = await resolveRole('roadmap', roadmapId, assigneeId, roadmapOwnerId)
      let via: ModuleRole | null = null
      if (portfolioId) {
        const pf = await prisma.portfolio.findUnique({ where: { id: portfolioId }, select: { ownerId: true } })
        if (pf) via = await resolveRole('portfolio', portfolioId, assigneeId, pf.ownerId)
      }
      return { role: bestRole(direct, via) }
    })()
    return role ? null : "L'assigné doit avoir accès au roadmap (invitez-le d'abord)."
  }

  app.post('/:id/items', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role, ownerId, portfolioId } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Roadmap introuvable' })
    const body = itemCreateSchema.parse(request.body)
    if (body.startDate > body.endDate) return reply.status(400).send({ error: 'La date de début doit précéder la fin' })

    const existing = await prisma.roadmapItem.findMany({ where: { roadmapId: id }, select: { id: true, deps: true } })
    const depsError = validateDeps(null, body.deps ?? [], existing)
    if (depsError) return reply.status(400).send({ error: depsError })
    const assigneeError = await validateAssignee(body.assigneeId, id, ownerId!, portfolioId)
    if (assigneeError) return reply.status(400).send({ error: assigneeError })

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
        status: body.status ?? 'TODO',
        assigneeId: body.assigneeId || null,
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
    const { role, ownerId, portfolioId } = await roleFor(id, userId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Roadmap introuvable' })
    const existingItem = await prisma.roadmapItem.findFirst({ where: { id: itemId, roadmapId: id } })
    if (!existingItem) return reply.status(404).send({ error: 'Item introuvable' })
    const body = itemUpdateSchema.parse(request.body)
    const startDate = body.startDate ?? existingItem.startDate
    const endDate = body.endDate ?? existingItem.endDate
    if (startDate > endDate) return reply.status(400).send({ error: 'La date de début doit précéder la fin' })

    if (body.deps !== undefined) {
      const allItems = await prisma.roadmapItem.findMany({ where: { roadmapId: id }, select: { id: true, deps: true } })
      const depsError = validateDeps(itemId, body.deps, allItems)
      if (depsError) return reply.status(400).send({ error: depsError })
    }
    if (body.assigneeId !== undefined) {
      const assigneeError = await validateAssignee(body.assigneeId, id, ownerId!, portfolioId)
      if (assigneeError) return reply.status(400).send({ error: assigneeError })
    }

    const item = await prisma.roadmapItem.update({
      where: { id: itemId },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.startDate !== undefined && { startDate: body.startDate }),
        ...(body.endDate !== undefined && { endDate: body.endDate }),
        ...(body.biz !== undefined && { biz: body.biz?.trim() || null }),
        ...(body.risk !== undefined && { risk: body.risk }),
        ...(body.prio !== undefined && { prio: body.prio }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId || null }),
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
