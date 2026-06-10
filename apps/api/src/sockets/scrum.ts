import type { Server, Socket } from 'socket.io'
import { prisma } from '../lib/prisma.js'

// In-memory participant registry: socketId → { name, roomId }
const participants = new Map<string, { name: string; roomId: string }>()

function roomKey(roomId: string) {
  return `scrum:${roomId}`
}

// Counted from the registry (not the socket.io room) so the host socket is
// excluded and the count always matches the names list.
function participantCount(roomId: string) {
  let n = 0
  for (const p of participants.values()) if (p.roomId === roomId) n++
  return n
}

function participantNames(roomId: string) {
  return [...participants.values()]
    .filter((p) => p.roomId === roomId)
    .map((p) => p.name)
}

// Host actions (reveal, reset, estimate…) are owner-only. Participants join
// anonymously, so every handler must gate on the authenticated userId itself
// (the socket middleware never rejects connections).
async function isOwner(socket: Socket, roomId: string): Promise<boolean> {
  const userId = socket.data.userId as string | undefined
  if (!userId) return false
  const cache: Record<string, boolean> = (socket.data.scrumOwner ??= {})
  if (cache[roomId] === undefined) {
    const room = await prisma.scrumRoom.findUnique({ where: { id: roomId }, select: { ownerId: true } })
    cache[roomId] = !!room && room.ownerId === userId
  }
  return cache[roomId]
}

export function scrumSocketHandlers(io: Server, socket: Socket) {
  // ── Host joins room ──────────────────────────────────────────────────────────
  socket.on('scrum:host_join', async (roomId: string) => {
    // Owner-only: scrum:state carries unmasked vote values, and participants
    // know the roomId (it is part of the scrum:joined payload).
    if (!(await isOwner(socket, roomId))) { socket.emit('scrum:error', 'Accès refusé'); return }
    await socket.join(roomKey(roomId))
    const room = await prisma.scrumRoom.findUnique({
      where: { id: roomId },
      include: {
        tickets: {
          include: { votes: { orderBy: { createdAt: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!room) return
    socket.emit('scrum:state', { room, participantCount: participantCount(roomId), participantNames: participantNames(roomId) })
  })

  // ── Participant joins via code ────────────────────────────────────────────────
  socket.on('scrum:join', async ({ code, participantName }: { code: string; participantName: string }) => {
    const room = await prisma.scrumRoom.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        tickets: {
          include: { votes: { orderBy: { createdAt: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!room) { socket.emit('scrum:error', 'Salle introuvable'); return }

    participants.set(socket.id, { name: participantName, roomId: room.id })
    await socket.join(roomKey(room.id))

    const count = participantCount(room.id)
    io.to(roomKey(room.id)).emit('scrum:participant_count', { count, names: participantNames(room.id) })

    // Hide vote values for tickets not yet revealed
    const sanitized = {
      ...room,
      tickets: room.tickets.map((t) => ({
        ...t,
        votes: t.status === 'REVEALED' || t.status === 'DONE'
          ? t.votes
          : t.votes.map((v) => ({ ...v, value: null })),
      })),
    }
    socket.emit('scrum:joined', { room: sanitized, participantName })
  })

  // ── Add ticket (host) ────────────────────────────────────────────────────────
  socket.on('scrum:ticket:add', async ({ roomId, title }: { roomId: string; title: string }) => {
    if (!(await isOwner(socket, roomId))) return
    const count = await prisma.scrumTicket.count({ where: { roomId } })
    const ticket = await prisma.scrumTicket.create({
      data: { roomId, title: title.trim(), order: count },
      include: { votes: true },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:added', ticket)
  })

  // ── Activate ticket for voting (host) ────────────────────────────────────────
  socket.on('scrum:ticket:activate', async ({ ticketId, roomId, scale }: { ticketId: string; roomId: string; scale: string }) => {
    if (!(await isOwner(socket, roomId))) return
    // Put any currently voting ticket back to PENDING
    await prisma.scrumTicket.updateMany({
      where: { roomId, status: 'VOTING' },
      data: { status: 'PENDING' },
    })
    // Clear all votes for this ticket (fresh round regardless of scale)
    await prisma.scrumVote.deleteMany({ where: { ticketId } })

    const ticket = await prisma.scrumTicket.update({
      where: { id: ticketId },
      data: { status: 'VOTING' },
      include: { votes: { where: { scale }, orderBy: { createdAt: 'asc' } } },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:activated', ticket)
  })

  // ── Participant votes ────────────────────────────────────────────────────────
  socket.on('scrum:vote', async ({ ticketId, value, participantName, roomId, scale }: { ticketId: string; value: string; participantName: string; roomId: string; scale: string }) => {
    await prisma.scrumVote.upsert({
      where: { ticketId_participantName_scale: { ticketId, participantName, scale } },
      create: { ticketId, participantName, value, scale },
      update: { value },
    })
    const [voteCount, voters] = await Promise.all([
      prisma.scrumVote.count({ where: { ticketId, scale } }),
      prisma.scrumVote.findMany({ where: { ticketId, scale }, select: { participantName: true }, orderBy: { createdAt: 'asc' } }),
    ])
    // Broadcast count + voter names — values stay hidden until reveal
    io.to(roomKey(roomId)).emit('scrum:vote:received', { ticketId, voteCount, voterNames: voters.map((v) => v.participantName) })
  })

  // ── Reveal votes (host) ──────────────────────────────────────────────────────
  socket.on('scrum:reveal', async ({ ticketId, roomId, scale }: { ticketId: string; roomId: string; scale: string }) => {
    if (!(await isOwner(socket, roomId))) return
    const ticket = await prisma.scrumTicket.update({
      where: { id: ticketId },
      data: { status: 'REVEALED' },
      include: { votes: { where: { scale }, orderBy: { createdAt: 'asc' } } },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:revealed', ticket)
  })

  // ── Set final estimate (host) ────────────────────────────────────────────────
  socket.on('scrum:ticket:estimate', async ({ ticketId, estimate, roomId, scale }: { ticketId: string; estimate: string; roomId: string; scale: string }) => {
    if (!(await isOwner(socket, roomId))) return
    const data = scale === 'TIME'
      ? { estimateTime: estimate, status: 'DONE' as const }
      : { estimate, status: 'DONE' as const }
    const ticket = await prisma.scrumTicket.update({
      where: { id: ticketId },
      data,
      include: { votes: { orderBy: { createdAt: 'asc' } } },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:done', ticket)
  })

  // ── Reset votes for revote (host) ────────────────────────────────────────────
  socket.on('scrum:ticket:reset', async ({ ticketId, roomId, scale }: { ticketId: string; roomId: string; scale: string }) => {
    if (!(await isOwner(socket, roomId))) return
    await prisma.scrumVote.deleteMany({ where: { ticketId, scale } })
    const ticket = await prisma.scrumTicket.update({
      where: { id: ticketId },
      data: { status: 'VOTING' },
      include: { votes: true },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:reset', { ticket, scale })
  })

  // ── Delete ticket (host) ─────────────────────────────────────────────────────
  socket.on('scrum:ticket:delete', async ({ ticketId, roomId }: { ticketId: string; roomId: string }) => {
    if (!(await isOwner(socket, roomId))) return
    await prisma.scrumTicket.delete({ where: { id: ticketId } })
    io.to(roomKey(roomId)).emit('scrum:ticket:deleted', ticketId)
  })

  // ── Bulk add tickets (host) ──────────────────────────────────────────────────
  socket.on('scrum:ticket:add_bulk', async ({ roomId, titles }: { roomId: string; titles: string[] }) => {
    if (!(await isOwner(socket, roomId))) return
    const count = await prisma.scrumTicket.count({ where: { roomId } })
    const tickets = await prisma.$transaction(
      titles.map((title, i) =>
        prisma.scrumTicket.create({
          data: { roomId, title: title.trim(), order: count + i },
          include: { votes: true },
        })
      )
    )
    for (const t of tickets) io.to(roomKey(roomId)).emit('scrum:ticket:added', t)
  })

  // ── Bulk estimate without vote (host) ────────────────────────────────────────
  socket.on('scrum:ticket:bulk_estimate', async ({ ticketIds, estimate, roomId, scale }: { ticketIds: string[]; estimate: string; roomId: string; scale: string }) => {
    if (!(await isOwner(socket, roomId))) return
    for (const ticketId of ticketIds) {
      const data = scale === 'TIME'
        ? { estimateTime: estimate, status: 'DONE' as const }
        : { estimate, status: 'DONE' as const }
      const ticket = await prisma.scrumTicket.update({
        where: { id: ticketId },
        data,
        include: { votes: { orderBy: { createdAt: 'asc' } } },
      })
      io.to(roomKey(roomId)).emit('scrum:ticket:done', ticket)
    }
  })

  // ── Update room estimation scale (host) ──────────────────────────────────────
  socket.on('scrum:room:update_scale', async ({ roomId, scale }: { roomId: string; scale: string }) => {
    if (!(await isOwner(socket, roomId))) return
    await prisma.scrumRoom.update({ where: { id: roomId }, data: { scale } })
    io.to(roomKey(roomId)).emit('scrum:room:scale_updated', scale)
  })

  // ── Cleanup on disconnect ────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const p = participants.get(socket.id)
    if (!p) return
    participants.delete(socket.id)
    const roomId = p.roomId

    // Count update is immediate…
    io.to(roomKey(roomId)).emit('scrum:participant_count', { count: participantCount(roomId), names: participantNames(roomId) })

    // …but the in-progress vote only gets cleaned up after a grace period, so
    // a page refresh (disconnect → reconnect under the same name) keeps it.
    setTimeout(async () => {
      const rejoined = [...participants.values()].some((q) => q.roomId === roomId && q.name === p.name)
      if (rejoined) return

      const activeTicket = await prisma.scrumTicket.findFirst({
        where: { roomId, status: 'VOTING' },
        select: { id: true },
      })
      if (!activeTicket) return

      const room = await prisma.scrumRoom.findUnique({ where: { id: roomId }, select: { scale: true } })
      const scale = room?.scale ?? 'FIBONACCI'
      await prisma.scrumVote.deleteMany({ where: { ticketId: activeTicket.id, participantName: p.name, scale } })
      const [voteCount, voters] = await Promise.all([
        prisma.scrumVote.count({ where: { ticketId: activeTicket.id, scale } }),
        prisma.scrumVote.findMany({ where: { ticketId: activeTicket.id, scale }, select: { participantName: true }, orderBy: { createdAt: 'asc' } }),
      ])
      io.to(roomKey(roomId)).emit('scrum:vote:received', { ticketId: activeTicket.id, voteCount, voterNames: voters.map((v) => v.participantName) })
    }, 2000)
  })
}
