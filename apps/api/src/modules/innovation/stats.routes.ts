import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { INNOVATION_BADGES, computePoints, type InnovationContributionStats } from './innovation-badges.js'

// Agrège fiches créées / votes reçus / challenges gagnés par auteur, pour tous les
// utilisateurs ayant au moins une fiche — base commune du leaderboard (/stats) et du
// profil individuel (/stats/me). Pas de jointure groupBy multi-table possible côté
// Prisma pour les votes reçus (ils portent sur InnovationVote, pas InnovationFiche
// directement) : agrégé en mémoire, volume attendu faible (outil interne).
// N'agrège que les fiches PUBLIC : une fiche privée ne rapporte pas de points (règle
// simple — "publier pour être crédité"), et évite de fuiter indirectement son existence
// via le leaderboard public (topContributors).
async function computeContributionStatsByUser(): Promise<Map<string, InnovationContributionStats>> {
  const [fiches, winningEntries] = await Promise.all([
    prisma.innovationFiche.findMany({ where: { visibility: 'PUBLIC' }, select: { authorId: true, _count: { select: { votes: true } } } }),
    prisma.challengeEntry.findMany({ where: { isWinner: true }, select: { fiche: { select: { authorId: true } } } }),
  ])

  const byUser = new Map<string, InnovationContributionStats>()
  function entry(userId: string): InnovationContributionStats {
    let e = byUser.get(userId)
    if (!e) { e = { ficheCount: 0, votesReceived: 0, challengesWon: 0 }; byUser.set(userId, e) }
    return e
  }
  for (const f of fiches) {
    const e = entry(f.authorId)
    e.ficheCount += 1
    e.votesReceived += f._count.votes
  }
  for (const w of winningEntries) {
    entry(w.fiche.authorId).challengesWon += 1
  }
  return byUser
}

// Dashboard de reporting du module Innovation (#230). Lecture seule, visible par
// tous les connectés — cohérent avec la visibilité globale des fiches.
export const innovationStatsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  app.get('/stats', async (request) => {
    const { id: userId } = request.user as { id: string }
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Toutes les agrégations sont scopées aux fiches PUBLIC — une fiche privée ne doit
    // apparaître dans aucun total/classement visible par d'autres que son périmètre
    // auteur/contributeur/admin (cf. canSeeFiche, innovation.routes.ts).
    const [totalFiches, byStatus, byCategoryRaw, fichesSansTag, recentFiches, challengesByStatus, contributorCount, topFichesRaw] =
      await Promise.all([
        prisma.innovationFiche.count({ where: { visibility: 'PUBLIC' } }),
        prisma.innovationFiche.groupBy({ by: ['status'], where: { visibility: 'PUBLIC' }, _count: { _all: true } }),
        // Compte des associations fiche↔tag (PR C, tags multi-valeurs) : une fiche à
        // 2 tags compte dans les deux — cohérent avec un nuage de tags, pas un histogramme de fiches.
        prisma.innovationFicheCategory.groupBy({ by: ['categoryId'], where: { fiche: { visibility: 'PUBLIC' } }, _count: { _all: true } }),
        prisma.innovationFiche.count({ where: { visibility: 'PUBLIC', categories: { none: {} } } }),
        prisma.innovationFiche.count({ where: { visibility: 'PUBLIC', createdAt: { gte: thirtyDaysAgo } } }),
        prisma.innovationChallenge.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.innovationContributor.findMany({ select: { userId: true }, distinct: ['userId'] }),
        prisma.innovationFiche.findMany({
          where: { visibility: 'PUBLIC' },
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
    const categoryIds = byCategoryRaw.map((c) => c.categoryId)
    const categories = categoryIds.length
      ? await prisma.innovationCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, label: true } })
      : []
    const labelById = new Map(categories.map((c) => [c.id, c.label]))

    return {
      totalFiches,
      recentFiches, // créées sur les 30 derniers jours
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byCategory: [
        ...byCategoryRaw.map((c) => ({ label: labelById.get(c.categoryId) ?? 'Inconnue', count: c._count._all })),
        ...(fichesSansTag > 0 ? [{ label: 'Sans catégorie', count: fichesSansTag }] : []),
      ].sort((a, b) => b.count - a.count),
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
      topContributors: await topContributors(),
    }
  })

  // Points/badges de l'utilisateur courant (PR E, gamification) — calculés à la volée,
  // rien de persisté (cf. commentaire de computeContributionStatsByUser).
  app.get('/stats/me', async (request) => {
    const { id: userId } = request.user as { id: string }
    const byUser = await computeContributionStatsByUser()
    const stats = byUser.get(userId) ?? { ficheCount: 0, votesReceived: 0, challengesWon: 0 }
    return {
      ...stats,
      points: computePoints(stats),
      badges: INNOVATION_BADGES.map((b) => ({ id: b.id, label: b.label, icon: b.icon, description: b.description, earned: b.check(stats) })),
    }
  })
}

async function topContributors() {
  const byUser = await computeContributionStatsByUser()
  const ranked = Array.from(byUser.entries())
    .map(([userId, stats]) => ({ userId, ...stats, points: computePoints(stats) }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10)

  const users = await prisma.user.findMany({ where: { id: { in: ranked.map((r) => r.userId) } }, select: { id: true, name: true } })
  const nameById = new Map(users.map((u) => [u.id, u.name]))
  return ranked.map((r) => ({ ...r, name: nameById.get(r.userId) ?? 'Utilisateur' }))
}
