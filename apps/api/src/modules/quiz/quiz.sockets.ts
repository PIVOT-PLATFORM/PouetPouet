import type { Server, Socket } from 'socket.io'
import { prisma } from '../../lib/prisma.js'

function roomKey(sessionId: string) {
  return `quiz:${sessionId}`
}

function calcPoints(points: number, timeLimit: number, responseMs: number): number {
  return Math.max(0, Math.round(points * (1 - responseMs / (timeLimit * 1000 * 0.5))))
}

async function buildState(sessionId: string) {
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: {
      quiz: { select: { title: true } },
      participants: { select: { id: true, name: true, score: true }, orderBy: { score: 'desc' } },
    },
  })
  if (!session) return null

  const totalQuestions = await prisma.quizQuestion.count({ where: { quizId: session.quizId } })

  let question: {
    index: number; total: number; text: string; options: string[]; timeLimit: number; points: number
  } | undefined
  if (session.status === 'QUESTION' || session.status === 'REVEAL') {
    const q = await prisma.quizQuestion.findFirst({
      where: { quizId: session.quizId },
      orderBy: { order: 'asc' },
      skip: session.currentQuestion,
    })
    if (q) {
      question = {
        index: session.currentQuestion,
        total: totalQuestions,
        text: q.text,
        options: q.options as string[],
        timeLimit: q.timeLimit,
        points: q.points,
      }
    }
  }

  return {
    sessionId: session.id,
    code: session.code,
    status: session.status,
    quizTitle: session.quiz.title,
    currentQuestion: session.currentQuestion,
    totalQuestions,
    participants: session.participants,
    questionEndAt: session.questionEndAt?.toISOString(),
    question,
  }
}

export function quizSocketHandlers(io: Server, socket: Socket) {
  // host joins the room
  socket.on('quiz:host_join', async ({ sessionId }: { sessionId: string }) => {
    const userId = socket.data.userId as string | undefined
    if (!userId) { socket.emit('quiz:error', 'Authentification requise'); return }

    const session = await prisma.quizSession.findUnique({ where: { id: sessionId } })
    if (!session || session.ownerId !== userId) {
      socket.emit('quiz:error', 'Session introuvable ou accès refusé')
      return
    }

    await socket.join(roomKey(sessionId))
    const state = await buildState(sessionId)
    if (state) socket.emit('quiz:state', state)
  })

  // participant joins
  socket.on('quiz:participant_join', async ({ code, name }: { code: string; name: string }) => {
    const session = await prisma.quizSession.findUnique({
      where: { code: code.toUpperCase() },
      include: { quiz: { select: { title: true } } },
    })
    if (!session) { socket.emit('quiz:error', 'Session introuvable'); return }
    if (session.status === 'ENDED') { socket.emit('quiz:error', 'Session terminée'); return }

    const participant = await prisma.quizParticipant.upsert({
      where: { sessionId_name: { sessionId: session.id, name: name.trim() } },
      create: { sessionId: session.id, name: name.trim() },
      update: {},
    })

    await socket.join(roomKey(session.id))
    socket.data.quizParticipantId = participant.id
    socket.data.quizSessionId = session.id

    socket.emit('quiz:joined', { participantId: participant.id })

    const state = await buildState(session.id)
    if (state) {
      socket.emit('quiz:state', state)
      io.to(roomKey(session.id)).emit('quiz:state', state)
    }
  })

  // host starts the session
  socket.on('quiz:start', async ({ sessionId }: { sessionId: string }) => {
    const userId = socket.data.userId as string | undefined
    if (!userId) return

    const session = await prisma.quizSession.findUnique({ where: { id: sessionId } })
    if (!session || session.ownerId !== userId || session.status !== 'LOBBY') return

    const firstQuestion = await prisma.quizQuestion.findFirst({
      where: { quizId: session.quizId },
      orderBy: { order: 'asc' },
    })
    if (!firstQuestion) { socket.emit('quiz:error', 'Aucune question dans ce quiz'); return }

    const questionEndAt = new Date(Date.now() + firstQuestion.timeLimit * 1000)
    await prisma.quizSession.update({
      where: { id: sessionId },
      data: { status: 'QUESTION', currentQuestion: 0, questionEndAt },
    })

    const state = await buildState(sessionId)
    if (state) io.to(roomKey(sessionId)).emit('quiz:state', state)

    io.to(roomKey(sessionId)).emit('quiz:question', {
      index: 0,
      total: await prisma.quizQuestion.count({ where: { quizId: session.quizId } }),
      text: firstQuestion.text,
      options: firstQuestion.options as string[],
      timeLimit: firstQuestion.timeLimit,
      points: firstQuestion.points,
    })

    setTimeout(async () => {
      const current = await prisma.quizSession.findUnique({ where: { id: sessionId } })
      if (!current || current.status !== 'QUESTION' || current.currentQuestion !== 0) return
      await revealCurrentQuestion(io, sessionId, firstQuestion.id)
    }, firstQuestion.timeLimit * 1000)
  })

  // participant answers
  socket.on('quiz:answer', async ({ sessionId, participantId, optionIndex, responseMs }: {
    sessionId: string; participantId: string; optionIndex: number; responseMs: number
  }) => {
    const session = await prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: { quiz: { select: { id: true } } },
    })
    if (!session || session.status !== 'QUESTION') return

    const question = await prisma.quizQuestion.findFirst({
      where: { quizId: session.quizId },
      orderBy: { order: 'asc' },
      skip: session.currentQuestion,
    })
    if (!question) return

    const existing = await prisma.quizAnswer.findUnique({
      where: { sessionId_questionId_participantId: { sessionId, questionId: question.id, participantId } },
    })
    if (existing) return

    const isCorrect = optionIndex === question.correct
    const pointsEarned = isCorrect ? calcPoints(question.points, question.timeLimit, responseMs) : 0

    await prisma.quizAnswer.create({
      data: { sessionId, questionId: question.id, participantId, optionIndex, isCorrect, responseMs, pointsEarned },
    })

    if (isCorrect) {
      await prisma.quizParticipant.update({
        where: { id: participantId },
        data: { score: { increment: pointsEarned } },
      })
    }

    socket.emit('quiz:answer_ack', { participantId, received: true })

    const totalParticipants = await prisma.quizParticipant.count({ where: { sessionId } })
    const totalAnswers = await prisma.quizAnswer.count({ where: { sessionId, questionId: question.id } })

    if (totalAnswers >= totalParticipants) {
      await revealCurrentQuestion(io, sessionId, question.id)
    }
  })

  // host goes to next question or leaderboard
  socket.on('quiz:next', async ({ sessionId }: { sessionId: string }) => {
    const userId = socket.data.userId as string | undefined
    if (!userId) return

    const session = await prisma.quizSession.findUnique({ where: { id: sessionId } })
    if (!session || session.ownerId !== userId) return
    if (session.status !== 'REVEAL' && session.status !== 'LEADERBOARD') return

    if (session.status === 'REVEAL') {
      await prisma.quizSession.update({ where: { id: sessionId }, data: { status: 'LEADERBOARD' } })
      const participants = await prisma.quizParticipant.findMany({
        where: { sessionId },
        orderBy: { score: 'desc' },
        take: 10,
      })
      io.to(roomKey(sessionId)).emit('quiz:leaderboard', {
        podium: participants.map((p) => ({ name: p.name, score: p.score })),
      })
      const state = await buildState(sessionId)
      if (state) io.to(roomKey(sessionId)).emit('quiz:state', state)
      return
    }

    const totalQuestions = await prisma.quizQuestion.count({ where: { quizId: session.quizId } })
    const nextIndex = session.currentQuestion + 1

    if (nextIndex >= totalQuestions) {
      await endSession(io, sessionId)
      return
    }

    const nextQuestion = await prisma.quizQuestion.findFirst({
      where: { quizId: session.quizId },
      orderBy: { order: 'asc' },
      skip: nextIndex,
    })
    if (!nextQuestion) { await endSession(io, sessionId); return }

    const questionEndAt = new Date(Date.now() + nextQuestion.timeLimit * 1000)
    await prisma.quizSession.update({
      where: { id: sessionId },
      data: { status: 'QUESTION', currentQuestion: nextIndex, questionEndAt },
    })

    const state = await buildState(sessionId)
    if (state) io.to(roomKey(sessionId)).emit('quiz:state', state)

    io.to(roomKey(sessionId)).emit('quiz:question', {
      index: nextIndex,
      total: totalQuestions,
      text: nextQuestion.text,
      options: nextQuestion.options as string[],
      timeLimit: nextQuestion.timeLimit,
      points: nextQuestion.points,
    })

    setTimeout(async () => {
      const current = await prisma.quizSession.findUnique({ where: { id: sessionId } })
      if (!current || current.status !== 'QUESTION' || current.currentQuestion !== nextIndex) return
      await revealCurrentQuestion(io, sessionId, nextQuestion.id)
    }, nextQuestion.timeLimit * 1000)
  })

  // host ends the session
  socket.on('quiz:end', async ({ sessionId }: { sessionId: string }) => {
    const userId = socket.data.userId as string | undefined
    if (!userId) return

    const session = await prisma.quizSession.findUnique({ where: { id: sessionId } })
    if (!session || session.ownerId !== userId) return

    await endSession(io, sessionId)
  })
}

async function revealCurrentQuestion(io: Server, sessionId: string, questionId: string) {
  const session = await prisma.quizSession.findUnique({
    where: { id: sessionId },
    include: { participants: { orderBy: { score: 'desc' } } },
  })
  if (!session || session.status !== 'QUESTION') return

  const question = await prisma.quizQuestion.findUnique({ where: { id: questionId } })
  if (!question) return

  const answers = await prisma.quizAnswer.findMany({ where: { sessionId, questionId } })
  const optionCount = (question.options as string[]).length
  const stats = Array(optionCount).fill(0) as number[]
  for (const a of answers) {
    if (a.optionIndex >= 0 && a.optionIndex < optionCount) stats[a.optionIndex]++
  }

  const participants = await prisma.quizParticipant.findMany({
    where: { sessionId },
    orderBy: { score: 'desc' },
  })
  const answerMap = new Map(answers.map((a) => [a.participantId, a.pointsEarned]))
  const scores = participants.map((p) => ({
    name: p.name,
    score: p.score,
    delta: answerMap.get(p.id) ?? 0,
  }))

  await prisma.quizSession.update({
    where: { id: sessionId },
    data: { status: 'REVEAL', questionEndAt: null },
  })

  io.to(roomKey(sessionId)).emit('quiz:reveal', {
    correct: question.correct,
    stats,
    scores,
  })

  const state = await buildState(sessionId)
  if (state) io.to(roomKey(sessionId)).emit('quiz:state', state)
}

async function endSession(io: Server, sessionId: string) {
  await prisma.quizSession.update({ where: { id: sessionId }, data: { status: 'ENDED' } })
  const participants = await prisma.quizParticipant.findMany({
    where: { sessionId },
    orderBy: { score: 'desc' },
  })
  const podium = participants.map((p, idx) => ({ name: p.name, score: p.score, rank: idx + 1 }))
  io.to(roomKey(sessionId)).emit('quiz:ended', { podium })

  const state = await buildState(sessionId)
  if (state) io.to(roomKey(sessionId)).emit('quiz:state', state)
}
