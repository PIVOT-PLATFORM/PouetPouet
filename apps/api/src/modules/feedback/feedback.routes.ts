import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { isAdminEmail } from '../../lib/feature-flags.js'

const createSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  type: z.enum(['BUG', 'FEATURE']).default('BUG'),
  authorName: z.string().min(1).max(80),
})

const moveSchema = z.object({
  column: z.enum(['ANALYSE', 'BACKLOG', 'IMPLEMENTING', 'PARKING', 'DONE']),
})

export const feedbackRoutes: FastifyPluginAsync = async (app) => {
  // GET / — liste tous les tickets, avec comptage des votes et flag hasVoted pour l'user connecté.
  app.get('/', async (request) => {
    let userId: string | null = null
    try {
      await request.jwtVerify()
      userId = (request.user as { id: string }).id
    } catch { /* public */ }

    const tickets = await prisma.feedbackTicket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { votes: true } },
        votes: userId ? { where: { userId }, select: { id: true } } : false,
      },
    })

    return tickets.map((t) => ({
      id: t.id,
      title: t.title,
      body: t.body,
      type: t.type,
      column: t.column,
      authorName: t.authorName,
      authorId: t.authorId,
      votes: t._count.votes,
      hasVoted: userId ? t.votes.length > 0 : false,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))
  })

  // POST / — création d'un ticket (public, auth optionnelle).
  app.post('/', async (request, reply) => {
    let userId: string | null = null
    try {
      await request.jwtVerify()
      userId = (request.user as { id: string }).id
    } catch { /* public */ }

    const body = createSchema.parse(request.body)

    const ticket = await prisma.feedbackTicket.create({
      data: {
        title: body.title,
        body: body.body,
        type: body.type,
        authorId: userId,
        authorName: body.authorName,
      },
    })
    return reply.status(201).send({ ...ticket, votes: 0, hasVoted: false })
  })

  // PATCH /:id/column — déplacer un ticket (admin uniquement).
  app.patch('/:id/column', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string; email: string }
    if (!isAdminEmail(user.email)) return reply.status(403).send({ error: 'Réservé aux administrateurs.' })

    const { id } = request.params as { id: string }
    const { column } = moveSchema.parse(request.body)

    const existing = await prisma.feedbackTicket.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Ticket introuvable.' })

    const ticket = await prisma.feedbackTicket.update({
      where: { id },
      data: { column },
      include: { _count: { select: { votes: true } } },
    })
    return reply.send({ ...ticket, votes: ticket._count.votes })
  })

  // POST /:id/vote — toggle vote (auth requise).
  app.post('/:id/vote', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id: ticketId } = request.params as { id: string }

    const existing = await prisma.feedbackTicket.findUnique({ where: { id: ticketId } })
    if (!existing) return reply.status(404).send({ error: 'Ticket introuvable.' })

    const alreadyVoted = await prisma.feedbackVote.findUnique({
      where: { ticketId_userId: { ticketId, userId } },
    })

    if (alreadyVoted) {
      await prisma.feedbackVote.delete({ where: { ticketId_userId: { ticketId, userId } } })
      const count = await prisma.feedbackVote.count({ where: { ticketId } })
      return reply.send({ hasVoted: false, votes: count })
    } else {
      await prisma.feedbackVote.create({ data: { ticketId, userId } })
      const count = await prisma.feedbackVote.count({ where: { ticketId } })
      return reply.send({ hasVoted: true, votes: count })
    }
  })
}
