import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'

const TEAM_INCLUDE = {
  members: { orderBy: { order: 'asc' as const } },
  _count: { select: { sessions: true, wheelDraws: true } },
}

export const dailyRoutes: FastifyPluginAsync = async (app) => {
  // â”€â”€ Teams â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.get('/teams', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.dailyTeam.findMany({
      where: { ownerId },
      include: TEAM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    })
  })

  app.post('/teams', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { name, members, color, description } = request.body as {
      name: string
      members?: string[]
      color?: string
      description?: string
    }
    if (!name?.trim()) return reply.status(400).send({ error: 'Name required' })
    const team = await prisma.dailyTeam.create({
      data: {
        name: name.trim(),
        ownerId,
        color: color ?? '#6366f1',
        description: description?.trim() || null,
        members: { create: (members ?? []).map((m, i) => ({ name: m.trim(), order: i })) },
      },
      include: TEAM_INCLUDE,
    })
    return reply.status(201).send(team)
  })

  app.put('/teams/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const { name, members, color, description } = request.body as {
      name: string
      members?: string[]
      color?: string
      description?: string
    }
    const team = await prisma.dailyTeam.findFirst({ where: { id, ownerId } })
    if (!team) return reply.status(404).send({ error: 'Team not found' })
    await prisma.dailyTeamMember.deleteMany({ where: { teamId: id } })
    const updated = await prisma.dailyTeam.update({
      where: { id },
      data: {
        name: name.trim(),
        color: color ?? team.color,
        description: description !== undefined ? (description?.trim() || null) : team.description,
        members: { create: (members ?? []).map((m, i) => ({ name: m.trim(), order: i })) },
      },
      include: TEAM_INCLUDE,
    })
    return updated
  })

  app.delete('/teams/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const team = await prisma.dailyTeam.findFirst({ where: { id, ownerId } })
    if (!team) return reply.status(404).send({ error: 'Team not found' })
    await prisma.dailyTeam.delete({ where: { id } })
    return reply.status(204).send()
  })

  // â”€â”€ Sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
