import type { Server, Socket } from 'socket.io'
import { prisma } from '../lib/prisma.js'

function canWrite(socket: Socket, boardId: string): boolean {
  const role = socket.data.boardRoles?.[boardId]
  return role === 'OWNER' || role === 'EDITOR'
}

function canAccess(socket: Socket, boardId: string): boolean {
  return !!socket.data.boardRoles?.[boardId]
}

type VoteSessionWithVotes = Awaited<ReturnType<typeof fetchSession>>

async function fetchSession(sessionId: string) {
  return prisma.boardVoteSession.findUnique({
    where: { id: sessionId },
    include: { votes: true },
  })
}

export function voteSocketHandlers(io: Server, socket: Socket) {
  // Start a vote session (OWNER / EDITOR only)
  socket.on('vote:start', async (data: {
    boardId: string
    votesPerPerson: number
    timerSeconds: number | null
    voterIds: string[]
  }) => {
    if (!canWrite(socket, data.boardId)) return

    // Close any existing active session first
    await prisma.boardVoteSession.updateMany({
      where: { boardId: data.boardId, status: 'ACTIVE' },
      data: { status: 'CLOSED', closedAt: new Date() },
    })

    const timerEndsAt = data.timerSeconds
      ? new Date(Date.now() + data.timerSeconds * 1000)
      : null

    const session = await prisma.boardVoteSession.create({
      data: {
        boardId: data.boardId,
        votesPerPerson: data.votesPerPerson,
        timerSeconds: data.timerSeconds,
        timerEndsAt,
        voterIds: data.voterIds,
      },
      include: { votes: true },
    })

    io.to(`board:${data.boardId}`).emit('vote:session:started', session)
  })

  // Cast one vote on a card
  socket.on('vote:cast', async (data: { sessionId: string; boardId: string; cardId: string }) => {
    if (!canAccess(socket, data.boardId)) return
    const userId = socket.data.userId as string | undefined
    if (!userId) return

    const session = await prisma.boardVoteSession.findUnique({
      where: { id: data.sessionId },
      include: { votes: { where: { userId } } },
    })
    if (!session || session.status !== 'ACTIVE') return
    if (session.timerEndsAt && session.timerEndsAt < new Date()) return
    if (!session.voterIds.includes(userId)) return
    if (session.votes.length >= session.votesPerPerson) return

    await prisma.boardVote.create({
      data: { sessionId: data.sessionId, cardId: data.cardId, userId },
    })

    const updated = await fetchSession(data.sessionId)
    io.to(`board:${data.boardId}`).emit('vote:updated', updated)
  })

  // Remove one vote from a card
  socket.on('vote:uncast', async (data: { sessionId: string; boardId: string; cardId: string }) => {
    if (!canAccess(socket, data.boardId)) return
    const userId = socket.data.userId as string | undefined
    if (!userId) return

    const existing = await prisma.boardVoteSession.findUnique({ where: { id: data.sessionId } })
    if (!existing || existing.status !== 'ACTIVE') return
    if (existing.timerEndsAt && existing.timerEndsAt < new Date()) return

    const vote = await prisma.boardVote.findFirst({
      where: { sessionId: data.sessionId, cardId: data.cardId, userId },
    })
    if (!vote) return

    await prisma.boardVote.delete({ where: { id: vote.id } })

    const updated = await fetchSession(data.sessionId)
    io.to(`board:${data.boardId}`).emit('vote:updated', updated)
  })

  // Extend the vote timer (OWNER only)
  socket.on('vote:extend', async (data: { sessionId: string; boardId: string; extraSeconds: number }) => {
    if (socket.data.boardRoles?.[data.boardId] !== 'OWNER') return

    const existing = await prisma.boardVoteSession.findUnique({ where: { id: data.sessionId } })
    if (!existing || existing.status !== 'ACTIVE' || !existing.timerEndsAt) return

    const base = existing.timerEndsAt.getTime() > Date.now()
      ? existing.timerEndsAt.getTime()
      : Date.now()
    const newEndsAt = new Date(base + data.extraSeconds * 1000)

    const session = await prisma.boardVoteSession.update({
      where: { id: data.sessionId },
      data: { timerEndsAt: newEndsAt },
      include: { votes: true },
    })

    io.to(`board:${data.boardId}`).emit('vote:updated', session)
  })

  // Close the vote session (OWNER / EDITOR only)
  socket.on('vote:stop', async (data: { sessionId: string; boardId: string }) => {
    if (!canWrite(socket, data.boardId)) return

    const session = await prisma.boardVoteSession.update({
      where: { id: data.sessionId },
      data: { status: 'CLOSED', closedAt: new Date() },
      include: { votes: true },
    })

    io.to(`board:${data.boardId}`).emit('vote:session:closed', session)
  })
}
