import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'

// Dashboard de reporting du module Innovation (#230). Lecture seule, visible par
// tous les connectés — cohérent avec la visibilité globale des fiches.
export const innovationStatsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  app.get('/stats', async (request) => {
    const { id: userId } = request.user as { id: string }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [totalFiches, byStatus, byCategory, recentFiches, challengesByStatus, contributorCount, topFichesRaw] =
      await Promise.all([
        prisma.innovationFiche.count(),
        prisma.innovationFiche.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.innovationFiche.groupBy({ by: ['categoryId'], _count: { _all: true } }),
        prisma.innovationFiche.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.innovationChallenge.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.innovationContributor.findMany({ select: { userId: true }, distinct: ['userId'] }),
        prisma.innovationFiche.findMany({
          orderBy: { votes: { _count: 'desc' } },
          take: 5,
          include: {
            author: { select: { id: true, name: true } },
            _count: { select: { votes: true } },
            votes: { where: { userId }, select: { id: true } },
          },
        }),
      ])

    // Résolution des labels de catégories (groupBy ne joint pas).
    const categoryIds = byCategory.map((c) => c.categoryId).filter((id): id is string => id !== null)
    const categories = categoryIds.length
      ? await prisma.innovationCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, label: true } })
      : []
    const labelById = new Map(categories.map((c) => [c.id, c.label]))

    return {
      totalFiches,
      recentFiches, // créées sur les 30 derniers jours
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byCategory: byCategory
        .map((c) => ({
          label: c.categoryId ? (labelById.get(c.categoryId) ?? 'Inconnue') : 'Sans catégorie',
          count: c._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      challenges: Object.fromEntries(challengesByStatus.map((s) => [s.status, s._count._all])),
      contributorCount: contributorCount.length,
      topFiches: topFichesRaw.map((f) => ({
        id: f.id,
        title: f.title,
        status: f.status,
        author: f.author,
        votes: f._count.votes,
        hasVoted: f.votes.length > 0,
      })),
    }
  })
}
