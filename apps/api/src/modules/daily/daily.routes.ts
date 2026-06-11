import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'

export const dailyRoutes: FastifyPluginAsync = async (app) => {
  // ── Sessions ──────────────────────────────────────────────────────────────────

  app.get('/sessions', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.dailySession.findMany({
      where: { ownerId },
      include: { participants: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/sessions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { name, timePerPerson, participants, teamId } = request.body as {
      name: string
      timePerPerson?: number
      participants: string[]
      teamId?: string
    }
    if (!name?.trim()) return reply.status(400).send({ error: 'Name required' })
    if (!participants?.length) return reply.status(400).send({ error: 'At least one participant required' })
    const session = await prisma.dailySession.create({
      data: {
        name: name.trim(),
        ownerId,
        teamId: teamId ?? null,
        timePerPerson: timePerPerson ?? 120,
        participants: { create: participants.map((p, i) => ({ name: p.trim(), order: i })) },
      },
      include: { participants: { orderBy: { order: 'asc' } } },
    })
    return reply.status(201).send(session)
  })

  app.get('/sessions/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const session = await prisma.dailySession.findFirst({
      where: { id, ownerId },
      include: { participants: { orderBy: { order: 'asc' } } },
    })
    if (!session) return reply.status(404).send({ error: 'Session not found' })
    return session
  })

  app.delete('/sessions/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const session = await prisma.dailySession.findFirst({ where: { id, ownerId } })
    if (!session) return reply.status(404).send({ error: 'Session not found' })
    await prisma.dailySession.delete({ where: { id } })
    return reply.status(204).send()
  })
}
