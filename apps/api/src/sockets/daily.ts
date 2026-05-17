import type { Server, Socket } from 'socket.io'
import { prisma } from '../lib/prisma.js'

function roomKey(sessionId: string) {
  return `daily:${sessionId}`
}

async function broadcastState(io: Server, sessionId: string) {
  const session = await prisma.dailySession.findUnique({
    where: { id: sessionId },
    include: { participants: { orderBy: { order: 'asc' } } },
  })
  if (session) io.to(roomKey(sessionId)).emit('daily:state', session)
}

async function advanceSpeaker(io: Server, sessionId: string, skip: boolean) {
  const session = await prisma.dailySession.findUnique({
    where: { id: sessionId },
    include: { participants: { orderBy: { order: 'asc' } } },
  })
  if (!session || session.status !== 'RUNNING') return

  const current = session.participants.find((p) => p.status === 'SPEAKING')
  if (!current) return

  const now = new Date()
  await prisma.dailyParticipant.update({
    where: { id: current.id },
    data: { status: skip ? 'SKIPPED' : 'DONE', doneSpeaking: now },
  })

  const nextOrder = current.order + 1
  const next = session.participants.find((p) => p.order === nextOrder)

  if (next) {
    await prisma.dailyParticipant.update({
      where: { id: next.id },
      data: { status: 'SPEAKING', speakingAt: now },
    })
    await prisma.dailySession.update({
      where: { id: sessionId },
      data: { currentIndex: nextOrder, updatedAt: now },
    })
  } else {
    await prisma.dailySession.update({
      where: { id: sessionId },
      data: { status: 'DONE', endedAt: now, currentIndex: nextOrder },
    })
  }

  await broadcastState(io, sessionId)
}

export function dailySocketHandlers(io: Server, socket: Socket) {
  // ── Host joins session room ───────────────────────────────────────────────────
  socket.on('daily:host_join', async (sessionId: string) => {
    await socket.join(roomKey(sessionId))
    await broadcastState(io, sessionId)
  })

  // ── Shuffle participant order (PENDING only) ──────────────────────────────────
  socket.on('daily:shuffle', async (sessionId: string) => {
    const participants = await prisma.dailyParticipant.findMany({
      where: { sessionId },
      orderBy: { order: 'asc' },
    })
    const shuffled = [...participants].sort(() => Math.random() - 0.5)
    await prisma.$transaction(
      shuffled.map((p, i) =>
        prisma.dailyParticipant.update({ where: { id: p.id }, data: { order: i } })
      )
    )
    await broadcastState(io, sessionId)
  })

  // ── Start session ─────────────────────────────────────────────────────────────
  socket.on('daily:start', async (sessionId: string) => {
    const now = new Date()
    const first = await prisma.dailyParticipant.findFirst({
      where: { sessionId },
      orderBy: { order: 'asc' },
    })
    if (!first) return
    await prisma.dailyParticipant.update({
      where: { id: first.id },
      data: { status: 'SPEAKING', speakingAt: now },
    })
    await prisma.dailySession.update({
      where: { id: sessionId },
      data: { status: 'RUNNING', currentIndex: 0, startedAt: now },
    })
    await broadcastState(io, sessionId)
  })

  // ── Pass to next ──────────────────────────────────────────────────────────────
  socket.on('daily:next', (sessionId: string) => advanceSpeaker(io, sessionId, false))

  // ── Skip current speaker ──────────────────────────────────────────────────────
  socket.on('daily:skip', (sessionId: string) => advanceSpeaker(io, sessionId, true))

  // ── End session manually ──────────────────────────────────────────────────────
  socket.on('daily:end', async (sessionId: string) => {
    const now = new Date()
    await prisma.dailyParticipant.updateMany({
      where: { sessionId, status: 'SPEAKING' },
      data: { status: 'DONE', doneSpeaking: now },
    })
    await prisma.dailySession.update({
      where: { id: sessionId },
      data: { status: 'DONE', endedAt: now },
    })
    await broadcastState(io, sessionId)
  })
}
