import type { Server, Socket } from 'socket.io'
import { prisma } from '../../lib/prisma.js'
import { bus } from '../../lib/bus.js'

// In-memory participant registry: socketId â†’ { name, roomId }
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

// Host actions (reveal, reset, estimateâ€¦) are owner-only. Participants join
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
  // â”€â”€ Host joins room â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('scrum:host_join', async (roomId: string) => {
    // Owner-only: scrum:state carries unmasked vote values, and participants
    // know the roomId (it is part of the scrum:joined payload).
    if (!(await isOwner(socket, roomId))) { socket.emit('scrum:error', 'AccÃ¨s refusÃ©'); return }
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

  // â”€â”€ Participant joins via code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Add ticket (host) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('scrum:ticket:add', async ({ roomId, title }: { roomId: string; title: string }) => {
    if (!(await isOwner(socket, roomId))) return
    const count = await prisma.scrumTicket.count({ where: { roomId } })
    const ticket = await prisma.scrumTicket.create({
      data: { roomId, title: title.trim(), order: count },
      include: { votes: true },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:added', ticket)
  })

  // â”€â”€ Activate ticket for voting (host) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Participant votes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // Broadcast count + voter names â€” values stay hidden until reveal
    io.to(roomKey(roomId)).emit('scrum:vote:received', { ticketId, voteCount, voterNames: voters.map((v) => v.participantName) })
  })

  // â”€â”€ Reveal votes (host) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('scrum:reveal', async ({ ticketId, roomId, scale }: { ticketId: string; roomId: string; scale: string }) => {
    if (!(await isOwner(socket, roomId))) return
    const ticket = await prisma.scrumTicket.update({
      where: { id: ticketId },
      data: { status: 'REVEALED' },
      include: { votes: { where: { scale }, orderBy: { createdAt: 'asc' } } },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:revealed', ticket)
  })

  // â”€â”€ Set final estimate (host) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // F3 : alimentera la vÃ©locitÃ© estimÃ©e du module CapacitÃ©
    bus.publish({
      type: 'scrum.ticket.estimated',
      module: 'scrum',
      actorId: socket.data.userId as string | undefined,
      payload: { roomId, ticketId, title: ticket.title, estimate, scale },
    })
  })

  // â”€â”€ Reset votes for revote (host) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Delete ticket (host) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('scrum:ticket:delete', async ({ ticketId, roomId }: { ticketId: string; roomId: string }) => {
    if (!(await isOwner(socket, roomId))) return
    await prisma.scrumTicket.delete({ where: { id: ticketId } })
    io.to(roomKey(roomId)).emit('scrum:ticket:deleted', ticketId)
  })

  // â”€â”€ Bulk add tickets (host) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Bulk estimate without vote (host) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Update room estimation scale (host) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('scrum:room:update_scale', async ({ roomId, scale }: { roomId: string; scale: string }) => {
    if (!(await isOwner(socket, roomId))) return
    await prisma.scrumRoom.update({ where: { id: roomId }, data: { scale } })
    io.to(roomKey(roomId)).emit('scrum:room:scale_updated', scale)
  })

  // â”€â”€ Cleanup on disconnect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('disconnect', () => {
    const p = participants.get(socket.id)
    if (!p) return
    participants.delete(socket.id)
    const roomId = p.roomId

    // Count update is immediateâ€¦
    io.to(roomKey(roomId)).emit('scrum:participant_count', { count: participantCount(roomId), names: participantNames(roomId) })

    // â€¦but the in-progress vote only gets cleaned up after a grace period, so
    // a page refresh (disconnect â†’ reconnect under the same name) keeps it.
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
