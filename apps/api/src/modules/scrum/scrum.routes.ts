import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const scrumRoutes: FastifyPluginAsync = async (app) => {
  // List rooms (authenticated)
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.scrumRoom.findMany({
      where: { ownerId },
      include: { tickets: { select: { id: true, status: true } } },
      orderBy: { updatedAt: 'desc' },
    })
  })

  // Create room (authenticated)
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { name, scale } = request.body as { name: string; scale?: string }
    if (!name?.trim()) return reply.status(400).send({ error: 'Name required' })

    const validScales = ['FIBONACCI', 'TIME']
    const roomScale = validScales.includes(scale ?? '') ? scale! : 'FIBONACCI'

    let code = generateCode()
    let attempts = 0
    while (await prisma.scrumRoom.findUnique({ where: { code } })) {
      code = generateCode()
      if (++attempts > 10) return reply.status(500).send({ error: 'Code generation failed' })
    }

    const room = await prisma.scrumRoom.create({
      data: { name: name.trim(), code, ownerId, scale: roomScale },
      include: { tickets: true },
    })
    return reply.status(201).send(room)
  })

  // Get room (authenticated)
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const room = await prisma.scrumRoom.findFirst({
      where: { id, ownerId },
      include: {
        tickets: {
          include: { votes: { orderBy: { createdAt: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    return room
  })

  // Delete room (authenticated)
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const room = await prisma.scrumRoom.findFirst({ where: { id, ownerId } })
    if (!room) return reply.status(404).send({ error: 'Room not found' })
    await prisma.scrumRoom.delete({ where: { id } })
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
