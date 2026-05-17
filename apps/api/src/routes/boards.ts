import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const boardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export const boardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  app.get('/', async (request) => {
    const { id } = request.user as { id: string }
    return prisma.board.findMany({
      where: { ownerId: id },
      orderBy: { updatedAt: 'desc' },
    })
  })

  app.post('/', async (request, reply) => {
    const { id } = request.user as { id: string }
    const body = boardSchema.parse(request.body)
    const board = await prisma.board.create({
      data: { ...body, ownerId: id },
    })
    return reply.status(201).send(board)
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const board = await prisma.board.findUnique({
      where: { id },
      include: { cards: { include: { fieldValues: true } } },
    })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    return reply.send(board)
  })

  app.delete('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (board.ownerId !== userId) return reply.status(403).send({ error: 'Accès refusé' })
    await prisma.board.delete({ where: { id } })
    return reply.status(204).send()
  })
}
