import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares, canManage } from '../../lib/module-share.js'

// Portfolio — regroupe plusieurs Roadmap pour une vue consolidée. Le rôle sur
// le portfolio (OWNER/EDITOR/VIEWER, via ModuleShare module='portfolio') donne
// un accès TRANSITIF aux roadmaps rattachées (cf. roadmap.routes.ts::roleFor) :
// pas besoin de partager chaque roadmap individuellement pour qu'un directeur
// voie tout le périmètre.

const portfolioCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
})
const portfolioUpdateSchema = portfolioCreateSchema.partial()

export const portfolioRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  async function roleFor(portfolioId: string, userId: string) {
    const pf = await prisma.portfolio.findUnique({ where: { id: portfolioId }, select: { ownerId: true } })
    if (!pf) return { role: null, ownerId: null }
    const role = await resolveRole('portfolio', portfolioId, userId, pf.ownerId)
    return { role, ownerId: pf.ownerId }
  }

  // Liste : portfolios possédés + partagés.
  app.get('/', async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('portfolio', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const portfolios = await prisma.portfolio.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      include: { _count: { select: { roadmaps: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return portfolios.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      ownerId: p.ownerId,
      roadmapCount: p._count.roadmaps,
      role: p.ownerId === userId ? 'OWNER' : (sharedRole.get(p.id) ?? 'VIEWER'),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  })

  // Détail : portfolio + roadmaps rattachées (résumé, sans les items — l'éditeur
  // consolidé les charge à la demande via /api/roadmap/:id comme d'habitude).
  app.get('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: {
        roadmaps: {
          orderBy: { updatedAt: 'desc' },
          include: { _count: { select: { items: true } } },
        },
      },
    })
    if (!portfolio) return reply.status(404).send({ error: 'Portefeuille introuvable' })
    const role = await resolveRole('portfolio', id, userId, portfolio.ownerId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    return {
      ...portfolio,
      roadmaps: portfolio.roadmaps.map((r) => ({
        id: r.id, name: r.name, startDate: r.startDate, endDate: r.endDate, scale: r.scale, itemCount: r._count.items,
      })),
      role,
    }
  })

  app.post('/', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = portfolioCreateSchema.parse(request.body)
    const portfolio = await prisma.portfolio.create({
      data: { name: body.name.trim(), description: body.description?.trim() || null, ownerId },
      include: { roadmaps: true },
    })
    return reply.status(201).send({ ...portfolio, role: 'OWNER' })
  })

  app.patch('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = await roleFor(id, userId)
    if (!canManage(role)) return reply.status(role ? 403 : 404).send({ error: role ? 'Accès refusé' : 'Portefeuille introuvable' })
    const body = portfolioUpdateSchema.parse(request.body)
    const updated = await prisma.portfolio.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.description !== undefined && { description: body.description?.trim() || null }),
      },
    })
    return { ...updated, role }
  })

  // Suppression — propriétaire uniquement. Les roadmaps rattachées sont
  // détachées (portfolioId → null), jamais supprimées (onDelete: SetNull).
  app.delete('/:id', async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const portfolio = await prisma.portfolio.findFirst({ where: { id, ownerId } })
    if (!portfolio) return reply.status(404).send({ error: 'Portefeuille introuvable' })
    await prisma.portfolio.delete({ where: { id } })
    await deleteResourceShares('portfolio', id)
    return reply.status(204).send()
  })

  // ── Rattachement de roadmaps ─────────────────────────────────────────────────

  // Rattache une roadmap existante — il faut pouvoir éditer le portfolio ET la
  // roadmap (sinon on pourrait exposer une roadmap privée d'un tiers via un
  // portfolio qu'on contrôle).
  app.post('/:id/roadmaps', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { roadmapId } = z.object({ roadmapId: z.string().min(1) }).parse(request.body)
    const { role: pfRole } = await roleFor(id, userId)
    if (!canManage(pfRole)) return reply.status(pfRole ? 403 : 404).send({ error: pfRole ? 'Accès refusé au portefeuille' : 'Portefeuille introuvable' })
    const roadmap = await prisma.roadmap.findUnique({ where: { id: roadmapId }, select: { ownerId: true } })
    if (!roadmap) return reply.status(404).send({ error: 'Roadmap introuvable' })
    const rmRole = await resolveRole('roadmap', roadmapId, userId, roadmap.ownerId)
    if (!canManage(rmRole)) return reply.status(403).send({ error: 'Accès refusé à cette roadmap' })
    await prisma.roadmap.update({ where: { id: roadmapId }, data: { portfolioId: id } })
    return reply.status(204).send()
  })

  // Détache — même garde que le rattachement.
  app.delete('/:id/roadmaps/:roadmapId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, roadmapId } = request.params as { id: string; roadmapId: string }
    const { role: pfRole } = await roleFor(id, userId)
    if (!canManage(pfRole)) return reply.status(pfRole ? 403 : 404).send({ error: pfRole ? 'Accès refusé au portefeuille' : 'Portefeuille introuvable' })
    const roadmap = await prisma.roadmap.findFirst({ where: { id: roadmapId, portfolioId: id } })
    if (!roadmap) return reply.status(404).send({ error: 'Roadmap introuvable dans ce portefeuille' })
    await prisma.roadmap.update({ where: { id: roadmapId }, data: { portfolioId: null } })
    return reply.status(204).send()
  })
}
