import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { isAdminEmail } from '../../lib/feature-flags.js'
import { bus } from '../../lib/bus.js'
import { serializeTicket } from './feedback-serialize.js'

const createSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  type: z.enum(['BUG', 'FEATURE']).default('BUG'),
  authorName: z.string().min(1).max(80),
})

const editSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  body: z.string().min(1).max(2000).optional(),
  type: z.enum(['BUG', 'FEATURE']).optional(),
})

const moveSchema = z.object({
  column: z.enum(['ANALYSE', 'BACKLOG', 'IMPLEMENTING', 'PARKING', 'DONE']),
})

const serialize = serializeTicket

export const feedbackRoutes: FastifyPluginAsync = async (app) => {
  // GET / — liste tous les tickets, avec comptage des votes et flag hasVoted.
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

    return tickets.map((t) => serialize(t, userId))
  })

  // POST / — création (public, auth optionnelle).
  app.post('/', async (request, reply) => {
    let userId: string | null = null
    try {
      await request.jwtVerify()
      userId = (request.user as { id: string }).id
    } catch { /* public */ }

    const body = createSchema.parse(request.body)

    const ticket = await prisma.feedbackTicket.create({
      data: { title: body.title, body: body.body, type: body.type, authorId: userId, authorName: body.authorName },
    })
    const payload = { ...ticket, votes: 0, hasVoted: false }
    bus.publish({ type: 'feedback.ticket.created', module: 'feedback', payload })
    return reply.status(201).send(payload)
  })

  // PATCH /:id — édition (auteur ou admin).
  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string; email: string }
    const { id } = request.params as { id: string }
    const data = editSchema.parse(request.body)

    const existing = await prisma.feedbackTicket.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Ticket introuvable.' })

    const canEdit = isAdminEmail(user.email) || existing.authorId === user.id
    if (!canEdit) return reply.status(403).send({ error: 'Vous ne pouvez pas modifier ce ticket.' })

    const ticket = await prisma.feedbackTicket.update({
      where: { id },
      data,
      include: { _count: { select: { votes: true } } },
    })
    const payload = serialize(ticket, user.id)
    bus.publish({ type: 'feedback.ticket.updated', module: 'feedback', payload })
    return reply.send(payload)
  })

  // PATCH /:id/column — déplacer (admin, dans les deux sens).
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
    const payload = serialize(ticket, user.id)
    bus.publish({ type: 'feedback.ticket.moved', module: 'feedback', payload })
    return reply.send(payload)
  })

  // DELETE /:id — suppression (admin uniquement).
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { id: string; email: string }
    if (!isAdminEmail(user.email)) return reply.status(403).send({ error: 'Réservé aux administrateurs.' })

    const { id } = request.params as { id: string }
    const existing = await prisma.feedbackTicket.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Ticket introuvable.' })

    await prisma.feedbackTicket.delete({ where: { id } })
    bus.publish({ type: 'feedback.ticket.deleted', module: 'feedback', payload: { id } })
    return reply.status(204).send()
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

    let result: { hasVoted: boolean; votes: number }
    if (alreadyVoted) {
      await prisma.feedbackVote.delete({ where: { ticketId_userId: { ticketId, userId } } })
      const count = await prisma.feedbackVote.count({ where: { ticketId } })
      result = { hasVoted: false, votes: count }
    } else {
      await prisma.feedbackVote.create({ data: { ticketId, userId } })
      const count = await prisma.feedbackVote.count({ where: { ticketId } })
      result = { hasVoted: true, votes: count }
    }

    bus.publish({ type: 'feedback.ticket.voted', module: 'feedback', payload: { ticketId, ...result } })
    return reply.send(result)
  })
}
