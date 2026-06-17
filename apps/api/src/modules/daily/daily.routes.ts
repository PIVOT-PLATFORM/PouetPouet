import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares } from '../../lib/module-share.js'

export const dailyRoutes: FastifyPluginAsync = async (app) => {
  // ── Sessions ──────────────────────────────────────────────────────────────────

  // Sessions possédées + partagées avec l'utilisateur (avec son rôle).
  app.get('/sessions', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('daily', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const sessions = await prisma.dailySession.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      include: { participants: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return sessions.map((s) => ({ ...s, role: s.ownerId === userId ? 'OWNER' : (sharedRole.get(s.id) ?? 'VIEWER') }))
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

  // Propriétaire ou utilisateur ayant un partage (sinon 404).
  app.get('/sessions/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    const session = await prisma.dailySession.findUnique({
      where: { id },
      include: { participants: { orderBy: { order: 'asc' } } },
    })
    if (!session) return reply.status(404).send({ error: 'Session not found' })
    const role = await resolveRole('daily', id, userId, session.ownerId)
    if (!role) return reply.status(404).send({ error: 'Session not found' })
    return { ...session, role }
  })

  // Propriétaire uniquement ; nettoie les partages associés.
  app.delete('/sessions/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const session = await prisma.dailySession.findFirst({ where: { id, ownerId } })
    if (!session) return reply.status(404).send({ error: 'Session not found' })
    await prisma.dailySession.delete({ where: { id } })
    await deleteResourceShares('daily', id)
    return reply.status(204).send()
  })
}
