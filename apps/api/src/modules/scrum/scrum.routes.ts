import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares } from '../../lib/module-share.js'

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const scrumRoutes: FastifyPluginAsync = async (app) => {
  // List rooms — celles que l'utilisateur possède + celles partagées avec lui.
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('scrum', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const rooms = await prisma.scrumRoom.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      include: {
        tickets: { select: { id: true, status: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return rooms.map((r) => ({ ...r, role: r.ownerId === userId ? 'OWNER' : (sharedRole.get(r.id) ?? 'VIEWER') }))
  })

  // Create room (authenticated)
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { name, scale, teamId } = request.body as { name: string; scale?: string; teamId?: string }
    if (!name?.trim()) return reply.status(400).send({ error: 'Name required' })

    const validScales = ['FIBONACCI', 'TIME']
    const roomScale = validScales.includes(scale ?? '') ? scale! : 'FIBONACCI'

    // Validate teamId ownership if provided
    if (teamId) {
      const team = await prisma.team.findFirst({ where: { id: teamId, ownerId } })
      if (!team) return reply.status(404).send({ error: 'Équipe introuvable.' })
    }

    let code = generateCode()
    let attempts = 0
    while (await prisma.scrumRoom.findUnique({ where: { code } })) {
      code = generateCode()
      if (++attempts > 10) return reply.status(500).send({ error: 'Code generation failed' })
    }

    const room = await prisma.scrumRoom.create({
      data: { name: name.trim(), code, ownerId, scale: roomScale, teamId: teamId ?? null },
      include: { tickets: true, team: { select: { id: true, name: true } } },
    })
    return reply.status(201).send(room)
  })

  // Get room — propriétaire ou utilisateur ayant un partage (sinon 404, ne fuite pas l'existence).
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    const room = await prisma.scrumRoom.findUnique({
      where: { id },
      include: {
        tickets: {
          include: { votes: { orderBy: { createdAt: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    const role = await resolveRole('scrum', id, userId, room.ownerId)
    if (!role) return reply.status(404).send({ error: 'Room not found' })
    return { ...room, role }
  })

  // Delete room — propriétaire uniquement ; nettoie les partages associés.
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const room = await prisma.scrumRoom.findFirst({ where: { id, ownerId } })
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    await prisma.scrumRoom.delete({ where: { id } })
    await deleteResourceShares('scrum', id)
    return reply.status(204).send()
  })

  // Verify room by code (public â€” participants use this)
  app.get('/join/:code', async (request, reply) => {
    const { code } = request.params as { code: string }
    const room = await prisma.scrumRoom.findUnique({
      where: { code: code.toUpperCase() },
      select: { id: true, name: true, code: true },
    })
    if (!room) return reply.status(404).send({ error: 'Salle introuvable' })
    return room
  })
}
