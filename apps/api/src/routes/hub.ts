import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'

// Hub stats — agrège les compteurs cross-modules pour le tableau de bord /hub.
// Toutes les données sont filtrées par l'utilisateur connecté (ses ressources uniquement).

export const hubRoutes: FastifyPluginAsync = async (app) => {
  app.get('/stats', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }

    const [boards, teams, scrumRooms, dailySessions, capacityEvents, wheelEvents, testBooks, parcourTemplates, forms] = await Promise.all([
      prisma.board.count({ where: { ownerId: userId } }),
      prisma.team.count({ where: { ownerId: userId } }),
      prisma.scrumRoom.count({ where: { ownerId: userId } }),
      prisma.dailySession.count({ where: { ownerId: userId } }),
      prisma.capacityEvent.count({ where: { ownerId: userId } }),
      prisma.wheelEvent.count({ where: { ownerId: userId } }),
      prisma.testBook.count({ where: { ownerId: userId } }),
      prisma.parcourTemplate.count({ where: { ownerId: userId } }),
      prisma.form.count({ where: { ownerId: userId } }),
    ])

    return { boards, teams, scrumRooms, dailySessions, capacityEvents, wheelEvents, testBooks, parcourTemplates, forms }
  })

  // Recent activity — dernières actions cross-modules pour la section "Récent" du hub.
  app.get('/recent', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }

    const [boards, dailySessions, scrumRooms, wheelDraws, parcourInstances] = await Promise.all([
      prisma.board.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 4,
        select: { id: true, name: true, updatedAt: true, coverImage: true },
      }),
      prisma.dailySession.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { id: true, name: true, status: true, endedAt: true, updatedAt: true },
      }),
      prisma.scrumRoom.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          name: true,
          code: true,
          updatedAt: true,
          team: { select: { id: true, name: true } },
          _count: { select: { tickets: true } },
        },
      }),
      prisma.wheelDraw.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { id: true, teamName: true, results: true, count: true, createdAt: true },
      }),
      prisma.parcourInstance.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: { id: true, title: true, refNumber: true, status: true, updatedAt: true },
      }),
    ])

    return { boards, dailySessions, scrumRooms, wheelDraws, parcourInstances }
  })

  // ── Intérêt pour les outils à venir (Explorateur) ──────────────────────────
  // Permet de prioriser la roadmap selon la demande réelle des utilisateurs.

  // Liste des outils pour lesquels l'utilisateur a exprimé un intérêt.
  app.get('/interest', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const rows = await prisma.toolInterest.findMany({ where: { userId }, select: { tool: true } })
    return rows.map((r) => r.tool)
  })

  // Bascule l'intérêt pour un outil à venir. Retourne l'état résultant + le total.
  app.post('/interest', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { tool } = request.body as { tool?: string }
    if (!tool || tool.length > 120) return reply.status(400).send({ error: 'Outil invalide' })

    const existing = await prisma.toolInterest.findUnique({ where: { tool_userId: { tool, userId } } })
    if (existing) {
      await prisma.toolInterest.delete({ where: { tool_userId: { tool, userId } } })
    } else {
      await prisma.toolInterest.create({ data: { tool, userId } })
    }
    const count = await prisma.toolInterest.count({ where: { tool } })
    return { interested: !existing, count }
  })
}
