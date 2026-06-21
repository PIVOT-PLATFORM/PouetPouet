import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../lib/prisma.js'

const VALID_GAMES = ['postit-rush', 'trivia', 'bingo'] as const
type GameId = (typeof VALID_GAMES)[number]

const submitSchema = z.object({
  game: z.enum(VALID_GAMES),
  score: z.number().int().min(0).max(1_000_000),
  metadata: z.record(z.unknown()).optional(),
})

export const gamesRoutes: FastifyPluginAsync = async (app) => {
  // Soumettre un score — authentifié
  app.post('/score', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { game, score, metadata } = submitSchema.parse(request.body)

    const entry = await prisma.gameScore.create({
      data: { userId, game, score, metadata: metadata !== undefined ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull },
      select: { id: true, score: true, createdAt: true },
    })
    return reply.status(201).send(entry)
  })

  // Leaderboard d'un jeu — top 20 + meilleur perso
  app.get('/scores/:game', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { game } = request.params as { game: string }

    if (!VALID_GAMES.includes(game as GameId)) {
      return reply.status(404).send({ error: 'Jeu inconnu.' })
    }

    const [top, myBest] = await Promise.all([
      prisma.gameScore.findMany({
        where: { game },
        orderBy: { score: 'desc' },
        take: 20,
        select: {
          id: true,
          score: true,
          metadata: true,
          createdAt: true,
          user: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.gameScore.findFirst({
        where: { game, userId },
        orderBy: { score: 'desc' },
        select: { score: true },
      }),
    ])

    return {
      scores: top.map((entry, i) => ({
        rank: i + 1,
        userId: entry.user.id,
        name: entry.user.name,
        avatar: entry.user.avatar,
        score: entry.score,
        metadata: entry.metadata,
        createdAt: entry.createdAt,
        isMe: entry.user.id === userId,
      })),
      myBest: myBest?.score ?? null,
    }
  })
}
