import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const createSessionSchema = z.object({
  boardId: z.string(),
})

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const sessionRoutes: FastifyPluginAsync = async (app) => {
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = createSessionSchema.parse(request.body)
    let code = generateCode()
    while (await prisma.session.findUnique({ where: { code } })) {
      code = generateCode()
    }
    const session = await prisma.session.create({
      data: { boardId: body.boardId, code },
    })
    return reply.status(201).send(session)
  })

  app.get('/join/:code', async (request, reply) => {
    const { code } = request.params as { code: string }
    const session = await prisma.session.findUnique({
      where: { code },
      include: { board: { select: { name: true, ownerId: true } } },
    })
    if (!session) return reply.status(404).send({ error: 'Session introuvable' })
    if (session.status === 'CLOSED') return reply.status(410).send({ error: 'Session terminée' })
    return reply.send(session)
  })

  app.patch('/:id/close', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const session = await prisma.session.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    })
    return reply.send(session)
  })

  // Active session for a board — used by board members to auto-join
  app.get('/active', async (request, reply) => {
    const { boardId } = request.query as { boardId?: string }
    if (!boardId) return reply.status(400).send({ error: 'boardId requis' })
    const session = await prisma.session.findFirst({
      where: { boardId, status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(session ?? null)
  })

  // Single session by ID — used by host on rejoin
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const session = await prisma.session.findUnique({ where: { id } })
    if (!session) return reply.status(404).send({ error: 'Session introuvable' })
    if (session.status === 'CLOSED') return reply.status(410).send({ error: 'Session terminée' })
    return reply.send(session)
  })
}
