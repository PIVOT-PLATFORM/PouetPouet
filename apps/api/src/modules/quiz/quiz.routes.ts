import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export const quizRoutes: FastifyPluginAsync = async (app) => {
  // ── Quiz CRUD ───────────────────────────────────────────────────────────────

  // GET /api/quiz — liste mes quiz
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    const quizzes = await prisma.quiz.findMany({
      where: { ownerId },
      include: { _count: { select: { questions: true } } },
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
    })
    const shareCounts = await prisma.moduleShare.groupBy({
      by: ['resourceId'],
      where: { module: 'quiz', resourceId: { in: quizzes.map((q) => q.id) } },
      _count: true,
    })
    const shareMap = Object.fromEntries(shareCounts.map((s) => [s.resourceId, s._count]))
    return quizzes.map((q) => ({ ...q, shareCount: shareMap[q.id] ?? 0 }))
  })

  // POST /api/quiz — créer un quiz
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { title } = request.body as { title: string }
    if (!title?.trim()) return reply.status(400).send({ error: 'Title required' })
    const quiz = await prisma.quiz.create({
      data: { title: title.trim(), ownerId },
      include: { _count: { select: { questions: true } } },
    })
    return reply.status(201).send(quiz)
  })

  // GET /api/quiz/:id — détail d'un quiz
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const quiz = await prisma.quiz.findFirst({
      where: { id, ownerId },
      include: { _count: { select: { questions: true } } },
    })
    if (!quiz) return reply.status(404).send({ error: 'Quiz introuvable' })
    return quiz
  })

  // PUT /api/quiz/:id — renommer
  app.put('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const { title } = request.body as { title: string }
    if (!title?.trim()) return reply.status(400).send({ error: 'Title required' })
    const quiz = await prisma.quiz.findFirst({ where: { id, ownerId } })
    if (!quiz) return reply.status(404).send({ error: 'Quiz introuvable' })
    const updated = await prisma.quiz.update({ where: { id }, data: { title: title.trim() } })
    return updated
  })

  // PATCH /api/quiz/:id/favorite — toggle favori
  app.patch('/:id/favorite', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const quiz = await prisma.quiz.findFirst({ where: { id, ownerId } })
    if (!quiz) return reply.status(404).send({ error: 'Quiz introuvable' })
    const updated = await prisma.quiz.update({ where: { id }, data: { isFavorite: !quiz.isFavorite } })
    return { isFavorite: updated.isFavorite }
  })

  // DELETE /api/quiz/:id — supprimer
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const quiz = await prisma.quiz.findFirst({ where: { id, ownerId } })
    if (!quiz) return reply.status(404).send({ error: 'Quiz introuvable' })
    await prisma.quiz.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── Questions ───────────────────────────────────────────────────────────────

  // GET /api/quiz/:id/questions
  app.get('/:id/questions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: quizId } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, ownerId } })
    if (!quiz) return reply.status(404).send({ error: 'Quiz introuvable' })
    const questions = await prisma.quizQuestion.findMany({
      where: { quizId },
      orderBy: { order: 'asc' },
    })
    return questions
  })

  // POST /api/quiz/:id/questions — ajouter une question
  app.post('/:id/questions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: quizId } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, ownerId } })
    if (!quiz) return reply.status(404).send({ error: 'Quiz introuvable' })
    const { text, options, correct, timeLimit, points, order } = request.body as {
      text: string; options: string[]; correct: number; timeLimit?: number; points?: number; order?: number
    }
    if (!text?.trim()) return reply.status(400).send({ error: 'Text required' })
    if (!Array.isArray(options) || options.length < 2 || options.length > 4) {
      return reply.status(400).send({ error: '2 to 4 options required' })
    }
    if (correct < 0 || correct >= options.length) {
      return reply.status(400).send({ error: 'Invalid correct index' })
    }
    const count = await prisma.quizQuestion.count({ where: { quizId } })
    const question = await prisma.quizQuestion.create({
      data: {
        quizId,
        text: text.trim(),
        options,
        correct,
        timeLimit: timeLimit ?? 30,
        points: points ?? 1000,
        order: order ?? count,
      },
    })
    return reply.status(201).send(question)
  })

  // PUT /api/quiz/questions/:qId — modifier
  app.put('/questions/:qId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { qId } = request.params as { qId: string }
    const { id: ownerId } = request.user as { id: string }
    const question = await prisma.quizQuestion.findUnique({
      where: { id: qId },
      include: { quiz: { select: { ownerId: true } } },
    })
    if (!question || question.quiz.ownerId !== ownerId) {
      return reply.status(404).send({ error: 'Question introuvable' })
    }
    const { text, options, correct, timeLimit, points, order } = request.body as {
      text?: string; options?: string[]; correct?: number; timeLimit?: number; points?: number; order?: number
    }
    const updated = await prisma.quizQuestion.update({
      where: { id: qId },
      data: {
        ...(text !== undefined ? { text: text.trim() } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(correct !== undefined ? { correct } : {}),
        ...(timeLimit !== undefined ? { timeLimit } : {}),
        ...(points !== undefined ? { points } : {}),
        ...(order !== undefined ? { order } : {}),
      },
    })
    return updated
  })

  // DELETE /api/quiz/questions/:qId — supprimer
  app.delete('/questions/:qId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { qId } = request.params as { qId: string }
    const { id: ownerId } = request.user as { id: string }
    const question = await prisma.quizQuestion.findUnique({
      where: { id: qId },
      include: { quiz: { select: { ownerId: true } } },
    })
    if (!question || question.quiz.ownerId !== ownerId) {
      return reply.status(404).send({ error: 'Question introuvable' })
    }
    await prisma.quizQuestion.delete({ where: { id: qId } })
    return reply.status(204).send()
  })

  // POST /api/quiz/:id/reorder — réordonner
  app.post('/:id/reorder', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: quizId } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, ownerId } })
    if (!quiz) return reply.status(404).send({ error: 'Quiz introuvable' })
    const { order } = request.body as { order: string[] }
    if (!Array.isArray(order)) return reply.status(400).send({ error: 'order array required' })
    await prisma.$transaction(
      order.map((qId, idx) =>
        prisma.quizQuestion.update({ where: { id: qId, quizId }, data: { order: idx } })
      )
    )
    return reply.status(204).send()
  })

  // ── Sessions ────────────────────────────────────────────────────────────────

  // POST /api/quiz/:id/session — créer une session
  app.post('/:id/session', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: quizId } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, ownerId } })
    if (!quiz) return reply.status(404).send({ error: 'Quiz introuvable' })

    let code = generateCode()
    let attempts = 0
    while (await prisma.quizSession.findUnique({ where: { code } })) {
      code = generateCode()
      if (++attempts > 10) return reply.status(500).send({ error: 'Code generation failed' })
    }

    const { title } = (request.body ?? {}) as { title?: string }
    const session = await prisma.quizSession.create({
      data: { quizId, ownerId, code, title: title?.trim() || null },
    })
    return reply.status(201).send({ sessionId: session.id, code: session.code })
  })

  // GET /api/quiz/:id/sessions — historique des sessions terminées
  app.get('/:id/sessions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: quizId } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const quiz = await prisma.quiz.findFirst({ where: { id: quizId, ownerId } })
    if (!quiz) return reply.status(404).send({ error: 'Quiz introuvable' })

    const sessions = await prisma.quizSession.findMany({
      where: { quizId, status: 'ENDED' },
      orderBy: { createdAt: 'desc' },
      include: {
        participants: {
          orderBy: { score: 'desc' },
          select: { name: true, score: true },
        },
      },
    })
    return sessions.map((s) => ({
      id: s.id,
      code: s.code,
      title: s.title,
      createdAt: s.createdAt,
      participantCount: s.participants.length,
      podium: s.participants,
    }))
  })

  // PATCH /api/quiz/session/:sessionId — renommer une session
  app.patch('/session/:sessionId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const { id: ownerId } = request.user as { id: string }
    const { title } = request.body as { title: string }
    const session = await prisma.quizSession.findFirst({ where: { id: sessionId, ownerId } })
    if (!session) return reply.status(404).send({ error: 'Session introuvable' })
    await prisma.quizSession.update({ where: { id: sessionId }, data: { title: title?.trim() || null } })
    return reply.status(204).send()
  })

  // GET /api/quiz/session/:code — état public de la session
  app.get('/session/:code', async (request, reply) => {
    const { code } = request.params as { code: string }
    const session = await prisma.quizSession.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        quiz: { select: { title: true } },
      },
    })
    if (!session) return reply.status(404).send({ error: 'Session introuvable' })
    return {
      sessionId: session.id,
      code: session.code,
      status: session.status,
      quizTitle: session.quiz.title,
    }
  })
}
