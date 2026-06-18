import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'

// Hub stats — agrège les compteurs cross-modules pour le tableau de bord /hub.
// Toutes les données sont filtrées par l'utilisateur connecté (ses ressources uniquement).

export const hubRoutes: FastifyPluginAsync = async (app) => {
  app.get('/stats', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }

    const [boards, teams, scrumRooms, dailySessions, capacityEvents, wheelEvents, testBooks] = await Promise.all([
      prisma.board.count({ where: { ownerId: userId } }),
      prisma.team.count({ where: { ownerId: userId } }),
      prisma.scrumRoom.count({ where: { ownerId: userId } }),
      prisma.dailySession.count({ where: { ownerId: userId } }),
      prisma.capacityEvent.count({ where: { ownerId: userId } }),
      prisma.wheelEvent.count({ where: { ownerId: userId } }),
      prisma.testBook.count({ where: { ownerId: userId } }),
    ])

    return { boards, teams, scrumRooms, dailySessions, capacityEvents, wheelEvents, testBooks }
  })

  // Recent activity — dernières actions cross-modules pour la section "Récent" du hub.
  app.get('/recent', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }

    const [boards, dailySessions, scrumRooms, wheelDraws] = await Promise.all([
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
    ])

    return { boards, dailySessions, scrumRooms, wheelDraws }
  })
}
