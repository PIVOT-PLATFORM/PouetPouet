import type { Server, Socket } from 'socket.io'
import { prisma } from '../../lib/prisma.js'
import { redis } from '../../lib/redis.js'
import { bus } from '../../lib/bus.js'
import { resolveRole, canManage, type ModuleRole } from '../../lib/module-share.js'

// Participant registry — Redis hash when available, in-memory Map as fallback (dev).
//
// Redis layout:
//   scrum:participants:{roomId}  Hash  socketId → name   (TTL 24h)
//   scrum:socket:{socketId}      String JSON { name, roomId }  (TTL 24h)
//
// The fallback Map is only used when Redis isn't connected (local dev without Redis).
const fallback = new Map<string, { name: string; roomId: string }>()

const PARTICIPANT_TTL = 86400

async function addParticipant(socketId: string, name: string, roomId: string) {
  if (redis.status === 'ready') {
    const p = redis.pipeline()
    p.hset(`scrum:participants:${roomId}`, socketId, name)
    p.expire(`scrum:participants:${roomId}`, PARTICIPANT_TTL)
    p.set(`scrum:socket:${socketId}`, JSON.stringify({ name, roomId }), 'EX', PARTICIPANT_TTL)
    await p.exec()
  } else {
    fallback.set(socketId, { name, roomId })
  }
}

async function removeParticipant(socketId: string): Promise<{ name: string; roomId: string } | null> {
  if (redis.status === 'ready') {
    const raw = await redis.get(`scrum:socket:${socketId}`)
    if (!raw) return null
    const info = JSON.parse(raw) as { name: string; roomId: string }
    await Promise.all([
      redis.hdel(`scrum:participants:${info.roomId}`, socketId),
      redis.del(`scrum:socket:${socketId}`),
    ])
    return info
  } else {
    const p = fallback.get(socketId)
    if (!p) return null
    fallback.delete(socketId)
    return p
  }
}

async function getParticipants(roomId: string): Promise<{ count: number; names: string[] }> {
  if (redis.status === 'ready') {
    const [count, names] = await Promise.all([
      redis.hlen(`scrum:participants:${roomId}`),
      redis.hvals(`scrum:participants:${roomId}`),
    ])
    return { count, names }
  } else {
    const names = [...fallback.values()].filter((p) => p.roomId === roomId).map((p) => p.name)
    return { count: names.length, names }
  }
}

async function hasParticipantWithName(roomId: string, name: string): Promise<boolean> {
  if (redis.status === 'ready') {
    const names = await redis.hvals(`scrum:participants:${roomId}`)
    return names.includes(name)
  } else {
    return [...fallback.values()].some((p) => p.roomId === roomId && p.name === name)
  }
}

function roomKey(roomId: string) {
  return `scrum:${roomId}`
}

// Active le premier ticket *existant* de la file (en sautant les ids supprimés),
// ouvre le vote dessus et émet scrum:ticket:activated. Renvoie la file effective
// (tête morte retirée). Mutualise la logique d'activation pour la file.
async function activateQueueHead(io: Server, roomId: string, scale: string, queue: string[]): Promise<string[]> {
  let q = [...queue]
  while (q.length > 0) {
    const headId = q[0]
    const exists = await prisma.scrumTicket.findUnique({ where: { id: headId }, select: { id: true } })
    if (!exists) { q = q.slice(1); continue } // ticket supprimé entre-temps
    await prisma.scrumTicket.updateMany({ where: { roomId, status: 'VOTING' }, data: { status: 'PENDING' } })
    await prisma.scrumVote.deleteMany({ where: { ticketId: headId } })
    const ticket = await prisma.scrumTicket.update({
      where: { id: headId },
      data: { status: 'VOTING' },
      include: { votes: { where: { scale }, orderBy: { createdAt: 'asc' } } },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:activated', ticket)
    return q
  }
  return q
}

// Rôle de l'utilisateur sur la salle (OWNER si créateur, sinon partage), mis en cache
// par socket. host_join est ouvert à tout rôle (VIEWER+) ; les mutations exigent EDITOR+.
async function getRoomRole(socket: Socket, roomId: string): Promise<ModuleRole | null> {
  const userId = socket.data.userId as string | undefined
  if (!userId) return null
  const cache: Record<string, ModuleRole | null> = (socket.data.scrumRole ??= {})
  if (cache[roomId] === undefined) {
    const room = await prisma.scrumRoom.findUnique({ where: { id: roomId }, select: { ownerId: true } })
    cache[roomId] = room ? await resolveRole('scrum', roomId, userId, room.ownerId) : null
  }
  return cache[roomId]
}

async function canManageRoom(socket: Socket, roomId: string): Promise<boolean> {
  return canManage(await getRoomRole(socket, roomId))
}

export function scrumSocketHandlers(io: Server, socket: Socket) {
  socket.on('scrum:host_join', async (roomId: string) => {
    if (!(await getRoomRole(socket, roomId))) { socket.emit('scrum:error', 'Accès refusé'); return }
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
    const { count, names } = await getParticipants(roomId)
    socket.emit('scrum:state', { room, participantCount: count, participantNames: names })
  })

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

    await addParticipant(socket.id, participantName, room.id)
    await socket.join(roomKey(room.id))

    const { count, names } = await getParticipants(room.id)
    io.to(roomKey(room.id)).emit('scrum:participant_count', { count, names })

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

  socket.on('scrum:ticket:add', async ({ roomId, title }: { roomId: string; title: string }) => {
    if (!(await canManageRoom(socket, roomId))) return
    const count = await prisma.scrumTicket.count({ where: { roomId } })
    const ticket = await prisma.scrumTicket.create({
      data: { roomId, title: title.trim(), order: count },
      include: { votes: true },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:added', ticket)
  })

  socket.on('scrum:ticket:activate', async ({ ticketId, roomId, scale }: { ticketId: string; roomId: string; scale: string }) => {
    if (!(await canManageRoom(socket, roomId))) return
    await prisma.scrumTicket.updateMany({ where: { roomId, status: 'VOTING' }, data: { status: 'PENDING' } })
    await prisma.scrumVote.deleteMany({ where: { ticketId } })
    const ticket = await prisma.scrumTicket.update({
      where: { id: ticketId },
      data: { status: 'VOTING' },
      include: { votes: { where: { scale }, orderBy: { createdAt: 'asc' } } },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:activated', ticket)
  })

  // ── File d'estimation : ordre de passage des tickets ──────────────────────────
  // Définit la file (liste ordonnée de ticketIds) et ouvre le vote sur le premier.
  socket.on('scrum:queue:set', async ({ roomId, ticketIds, scale }: { roomId: string; ticketIds: string[]; scale: string }) => {
    if (!(await canManageRoom(socket, roomId))) return
    // Ne garder que les tickets existants de cette salle, dans l'ordre fourni.
    const valid = await prisma.scrumTicket.findMany({ where: { id: { in: ticketIds }, roomId }, select: { id: true } })
    const validSet = new Set(valid.map((t) => t.id))
    let queue = ticketIds.filter((id) => validSet.has(id))
    queue = await activateQueueHead(io, roomId, scale, queue)
    await prisma.scrumRoom.update({ where: { id: roomId }, data: { queue } })
    io.to(roomKey(roomId)).emit('scrum:queue:updated', { queue })
  })

  socket.on('scrum:queue:clear', async ({ roomId }: { roomId: string }) => {
    if (!(await canManageRoom(socket, roomId))) return
    await prisma.scrumRoom.update({ where: { id: roomId }, data: { queue: [] } })
    io.to(roomKey(roomId)).emit('scrum:queue:updated', { queue: [] })
  })

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
    io.to(roomKey(roomId)).emit('scrum:vote:received', { ticketId, voteCount, voterNames: voters.map((v) => v.participantName) })
  })

  socket.on('scrum:reveal', async ({ ticketId, roomId, scale }: { ticketId: string; roomId: string; scale: string }) => {
    if (!(await canManageRoom(socket, roomId))) return
    const ticket = await prisma.scrumTicket.update({
      where: { id: ticketId },
      data: { status: 'REVEALED' },
      include: { votes: { where: { scale }, orderBy: { createdAt: 'asc' } } },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:revealed', ticket)
  })

  socket.on('scrum:ticket:estimate', async ({ ticketId, estimate, roomId, scale }: { ticketId: string; estimate: string; roomId: string; scale: string }) => {
    if (!(await canManageRoom(socket, roomId))) return
    const data = scale === 'TIME'
      ? { estimateTime: estimate, status: 'DONE' as const }
      : { estimate, status: 'DONE' as const }
    const ticket = await prisma.scrumTicket.update({
      where: { id: ticketId },
      data,
      include: { votes: { orderBy: { createdAt: 'asc' } } },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:done', ticket)
    bus.publish({
      type: 'scrum.ticket.estimated',
      module: 'scrum',
      actorId: socket.data.userId as string | undefined,
      payload: { roomId, ticketId, title: ticket.title, estimate, scale },
    })

    // File d'estimation : si ce ticket était en tête de file, on l'en retire et
    // on ouvre automatiquement le vote sur le suivant.
    const room = await prisma.scrumRoom.findUnique({ where: { id: roomId }, select: { queue: true } })
    if (room && room.queue.includes(ticketId)) {
      const wasHead = room.queue[0] === ticketId
      let queue = room.queue.filter((id) => id !== ticketId)
      if (wasHead && queue.length > 0) queue = await activateQueueHead(io, roomId, scale, queue)
      await prisma.scrumRoom.update({ where: { id: roomId }, data: { queue } })
      io.to(roomKey(roomId)).emit('scrum:queue:updated', { queue })
    }
  })

  socket.on('scrum:ticket:reset', async ({ ticketId, roomId, scale }: { ticketId: string; roomId: string; scale: string }) => {
    if (!(await canManageRoom(socket, roomId))) return
    await prisma.scrumVote.deleteMany({ where: { ticketId, scale } })
    const ticket = await prisma.scrumTicket.update({
      where: { id: ticketId },
      data: { status: 'VOTING' },
      include: { votes: true },
    })
    io.to(roomKey(roomId)).emit('scrum:ticket:reset', { ticket, scale })
  })

  socket.on('scrum:ticket:delete', async ({ ticketId, roomId }: { ticketId: string; roomId: string }) => {
    if (!(await canManageRoom(socket, roomId))) return
    await prisma.scrumTicket.delete({ where: { id: ticketId } })
    io.to(roomKey(roomId)).emit('scrum:ticket:deleted', ticketId)
    // Retirer le ticket supprimé de la file s'il y figurait.
    const room = await prisma.scrumRoom.findUnique({ where: { id: roomId }, select: { queue: true } })
    if (room && room.queue.includes(ticketId)) {
      const queue = room.queue.filter((id) => id !== ticketId)
      await prisma.scrumRoom.update({ where: { id: roomId }, data: { queue } })
      io.to(roomKey(roomId)).emit('scrum:queue:updated', { queue })
    }
  })

  socket.on('scrum:ticket:add_bulk', async ({ roomId, titles }: { roomId: string; titles: string[] }) => {
    if (!(await canManageRoom(socket, roomId))) return
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

  socket.on('scrum:ticket:bulk_estimate', async ({ ticketIds, estimate, roomId, scale }: { ticketIds: string[]; estimate: string; roomId: string; scale: string }) => {
    if (!(await canManageRoom(socket, roomId))) return
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

  socket.on('scrum:room:update_scale', async ({ roomId, scale }: { roomId: string; scale: string }) => {
    if (!(await canManageRoom(socket, roomId))) return
    await prisma.scrumRoom.update({ where: { id: roomId }, data: { scale } })
    io.to(roomKey(roomId)).emit('scrum:room:scale_updated', scale)
  })

  socket.on('disconnect', async () => {
    const p = await removeParticipant(socket.id)
    if (!p) return
    const { roomId, name } = p

    const { count, names } = await getParticipants(roomId)
    io.to(roomKey(roomId)).emit('scrum:participant_count', { count, names })

    setTimeout(async () => {
      if (await hasParticipantWithName(roomId, name)) return

      const activeTicket = await prisma.scrumTicket.findFirst({
        where: { roomId, status: 'VOTING' },
        select: { id: true },
      })
      if (!activeTicket) return

      const room = await prisma.scrumRoom.findUnique({ where: { id: roomId }, select: { scale: true } })
      const scale = room?.scale ?? 'FIBONACCI'
      await prisma.scrumVote.deleteMany({ where: { ticketId: activeTicket.id, participantName: name, scale } })
      const [voteCount, voters] = await Promise.all([
        prisma.scrumVote.count({ where: { ticketId: activeTicket.id, scale } }),
        prisma.scrumVote.findMany({ where: { ticketId: activeTicket.id, scale }, select: { participantName: true }, orderBy: { createdAt: 'asc' } }),
      ])
      io.to(roomKey(roomId)).emit('scrum:vote:received', { ticketId: activeTicket.id, voteCount, voterNames: voters.map((v) => v.participantName) })
    }, 2000)
  })
}
