import { randomUUID } from 'crypto'
import type { Server, Socket } from 'socket.io'
import { prisma } from '../../lib/prisma.js'
import { redis } from '../../lib/redis.js'

function canWrite(socket: Socket, boardId: string): boolean {
  const role = socket.data.boardRoles?.[boardId]
  return role === 'OWNER' || role === 'EDITOR'
}

// Realtime mutations can race with a delete from another client (or the same one).
// Swallow Prisma's "record not found" (P2025) and "foreign key violation" (P2003 â€”
// e.g. upserting a field value on a just-deleted card) so a stale event never
// crashes the handler.
async function ignoreMissing<T>(op: Promise<T>): Promise<T | null> {
  try {
    return await op
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'P2025' || code === 'P2003') return null
    throw err
  }
}

// Presence cache — Redis hash when available, in-memory via fetchSockets as fallback.
//
// Redis layout: board:presence:{boardId}  Hash  userId → JSON { id, name, avatar }
// TTL is refreshed on each join (1 hour). On leave/disconnect the field is removed.

const PRESENCE_TTL = 3600

async function addPresence(boardId: string, user: { id: string; name: string; avatar: string | null }) {
  if (redis.status !== 'ready') return
  const key = `board:presence:${boardId}`
  await redis.hset(key, user.id, JSON.stringify(user))
  await redis.expire(key, PRESENCE_TTL)
}

async function removePresence(boardId: string, userId: string) {
  if (redis.status !== 'ready') return
  await redis.hdel(`board:presence:${boardId}`, userId)
}

async function broadcastPresence(io: Server, boardId: string) {
  let users: { id: string; name: string; avatar: string | null }[]

  if (redis.status === 'ready') {
    const vals = await redis.hvals(`board:presence:${boardId}`)
    users = vals.map((v) => JSON.parse(v) as { id: string; name: string; avatar: string | null })
  } else {
    const sockets = await io.in(`board:${boardId}`).fetchSockets()
    const seen = new Set<string>()
    users = []
    for (const s of sockets) {
      const info = s.data.userInfo as { id: string; name: string; avatar: string | null } | undefined
      if (info && !seen.has(info.id)) { seen.add(info.id); users.push(info) }
    }
  }

  io.to(`board:${boardId}`).emit('board:presence', users)
}

export function boardSocketHandlers(io: Server, socket: Socket) {
  // â”€â”€ Board state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('board:join', async (boardId: string) => {
    const userId: string | undefined = socket.data.userId
    if (!userId) { socket.emit('board:error', 'AccÃ¨s refusÃ©'); return }
    const board = await prisma.board.findUnique({ where: { id: boardId } })
    if (!board) { socket.emit('board:error', 'Board introuvable'); return }

    let role: 'OWNER' | 'EDITOR' | 'VIEWER' | null = null
    if (board.ownerId === userId) {
      role = 'OWNER'
    } else {
      const share = await prisma.boardShare.findUnique({
        where: { boardId_userId: { boardId, userId } },
        select: { role: true },
      })
      if (share) role = share.role as 'EDITOR' | 'VIEWER'
    }

    if (!role) { socket.emit('board:error', 'AccÃ¨s refusÃ©'); return }

    socket.data.boardRoles = socket.data.boardRoles ?? {}
    socket.data.boardRoles[boardId] = role

    if (!socket.data.userInfo) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, avatar: true },
      })
      socket.data.userInfo = user
    }

    await socket.join(`board:${boardId}`)
    const [cards, connections, frames, fields] = await Promise.all([
      prisma.card.findMany({ where: { boardId }, include: { fieldValues: true } }),
      prisma.cardConnection.findMany({ where: { boardId } }),
      prisma.frame.findMany({ where: { boardId } }),
      prisma.boardField.findMany({ where: { boardId }, orderBy: { order: 'asc' } }),
    ])
    socket.emit('board:state', { cards, connections, frames, fields, role })
    if (socket.data.userInfo) await addPresence(boardId, socket.data.userInfo as { id: string; name: string; avatar: string | null })
    await broadcastPresence(io, boardId)
  })

  socket.on('board:leave', async (boardId: string) => {
    socket.leave(`board:${boardId}`)
    const info = socket.data.userInfo as { id: string } | undefined
    if (info) await removePresence(boardId, info.id)
    await broadcastPresence(io, boardId)
  })

  socket.on('disconnect', async () => {
    const boardRoles = socket.data.boardRoles as Record<string, string> | undefined
    if (!boardRoles) return
    const info = socket.data.userInfo as { id: string } | undefined
    for (const boardId of Object.keys(boardRoles)) {
      if (info) await removePresence(boardId, info.id)
      await broadcastPresence(io, boardId)
    }
  })

  // â”€â”€ Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('card:create', async (data: { boardId: string; content: string; posX: number; posY: number; color?: string; type?: string; width?: number; height?: number; layer?: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await prisma.card.create({ data: data as never, include: { fieldValues: true } })
    io.to(`board:${data.boardId}`).emit('card:created', card)
  })

  socket.on('card:move', async (data: { id: string; boardId: string; posX: number; posY: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await ignoreMissing(prisma.card.update({ where: { id: data.id }, data: { posX: data.posX, posY: data.posY } }))
    if (card) socket.to(`board:${data.boardId}`).emit('card:moved', card)
  })

  socket.on('card:resize', async (data: { id: string; boardId: string; width: number; height: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await ignoreMissing(prisma.card.update({ where: { id: data.id }, data: { width: data.width, height: data.height } }))
    if (card) socket.to(`board:${data.boardId}`).emit('card:resized', card)
  })

  socket.on('card:update', async (data: { id: string; boardId: string; content: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await ignoreMissing(prisma.card.update({ where: { id: data.id }, data: { content: data.content } }))
    if (card) io.to(`board:${data.boardId}`).emit('card:updated', card)
  })

  socket.on('card:delete', async (data: { id: string; boardId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const deleted = await ignoreMissing(prisma.card.delete({ where: { id: data.id } }))
    if (!deleted) return
    io.to(`board:${data.boardId}`).emit('card:deleted', data.id)
    // A group of one is meaningless: if deleting this card leaves its group with a
    // single remaining member, dissolve the group automatically.
    if (deleted.groupId) {
      const remaining = await prisma.card.findMany({
        where: { groupId: deleted.groupId, boardId: data.boardId },
        select: { id: true },
      })
      if (remaining.length === 1) {
        // The lone survivor may itself have been deleted by a concurrent
        // card:delete (bulk/group deletion races) â€” tolerate the missing row.
        const ungrouped = await ignoreMissing(
          prisma.card.update({ where: { id: remaining[0].id }, data: { groupId: null } })
        )
        if (ungrouped) io.to(`board:${data.boardId}`).emit('cards:ungrouped', deleted.groupId)
      }
    }
  })

  socket.on('card:recolor', async (data: { id: string; boardId: string; color: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await ignoreMissing(prisma.card.update({ where: { id: data.id }, data: { color: data.color } }))
    if (card) io.to(`board:${data.boardId}`).emit('card:recolored', card)
  })

  socket.on('card:lock', async (data: { ids: string[]; boardId: string; locked: boolean }) => {
    if (!canWrite(socket, data.boardId)) return
    await prisma.card.updateMany({ where: { id: { in: data.ids }, boardId: data.boardId }, data: { locked: data.locked } })
    io.to(`board:${data.boardId}`).emit('cards:locked', { ids: data.ids, locked: data.locked })
  })

  socket.on('card:layer', async (data: { id: string; boardId: string; layer: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await ignoreMissing(prisma.card.update({ where: { id: data.id }, data: { layer: data.layer } }))
    if (card) io.to(`board:${data.boardId}`).emit('card:layered', { id: data.id, layer: data.layer })
  })

  // â”€â”€ Groups â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('cards:group', async (data: { boardId: string; cardIds: string[] }) => {
    if (!canWrite(socket, data.boardId)) return
    const groupId = randomUUID()
    await prisma.card.updateMany({ where: { id: { in: data.cardIds }, boardId: data.boardId }, data: { groupId } })
    io.to(`board:${data.boardId}`).emit('cards:grouped', { cardIds: data.cardIds, groupId })
  })

  socket.on('cards:ungroup', async (data: { boardId: string; groupId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    await prisma.card.updateMany({ where: { groupId: data.groupId, boardId: data.boardId }, data: { groupId: null } })
    io.to(`board:${data.boardId}`).emit('cards:ungrouped', data.groupId)
  })

  socket.on('cards:group-color', async (data: { boardId: string; groupId: string; color: string }) => {
    if (!canWrite(socket, data.boardId)) return
    await prisma.card.updateMany({ where: { groupId: data.groupId, boardId: data.boardId }, data: { groupColor: data.color } })
    io.to(`board:${data.boardId}`).emit('cards:group-colored', { groupId: data.groupId, color: data.color })
  })

  // â”€â”€ Connections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('connection:create', async (data: { boardId: string; fromId: string; toId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const existing = await prisma.cardConnection.findFirst({ where: { boardId: data.boardId, fromId: data.fromId, toId: data.toId } })
    if (existing) return
    const connection = await prisma.cardConnection.create({ data })
    io.to(`board:${data.boardId}`).emit('connection:created', connection)
  })

  socket.on('connection:delete', async (data: { id: string; boardId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const deleted = await ignoreMissing(prisma.cardConnection.delete({ where: { id: data.id } }))
    if (deleted) io.to(`board:${data.boardId}`).emit('connection:deleted', data.id)
  })

  socket.on('connection:update', async (data: {
    id: string; boardId: string
    label?: string | null; color?: string | null; shape?: string; arrow?: string; dashed?: boolean; width?: number
  }) => {
    if (!canWrite(socket, data.boardId)) return
    const patch: Record<string, unknown> = {}
    if (data.label !== undefined) patch.label = data.label
    if (data.color !== undefined) patch.color = data.color
    if (data.shape !== undefined) patch.shape = data.shape
    if (data.arrow !== undefined) patch.arrow = data.arrow
    if (data.dashed !== undefined) patch.dashed = data.dashed
    if (data.width !== undefined) patch.width = data.width
    if (Object.keys(patch).length === 0) return
    const updated = await ignoreMissing(prisma.cardConnection.update({ where: { id: data.id }, data: patch }))
    if (updated) io.to(`board:${data.boardId}`).emit('connection:updated', updated)
  })

  // â”€â”€ Frames â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('frame:create', async (data: { boardId: string; posX: number; posY: number; title?: string; color?: string; width?: number; height?: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const frame = await prisma.frame.create({ data })
    io.to(`board:${data.boardId}`).emit('frame:created', frame)
  })

  socket.on('frame:move', async (data: { id: string; boardId: string; posX: number; posY: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const frame = await ignoreMissing(prisma.frame.update({ where: { id: data.id }, data: { posX: data.posX, posY: data.posY } }))
    if (frame) socket.to(`board:${data.boardId}`).emit('frame:moved', frame)
  })

  socket.on('frame:resize', async (data: { id: string; boardId: string; width: number; height: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const frame = await ignoreMissing(prisma.frame.update({ where: { id: data.id }, data: { width: data.width, height: data.height } }))
    if (frame) socket.to(`board:${data.boardId}`).emit('frame:resized', frame)
  })

  socket.on('frame:update', async (data: { id: string; boardId: string; title?: string; active?: boolean }) => {
    if (!canWrite(socket, data.boardId)) return
    const patch: { title?: string; active?: boolean } = {}
    if (data.title !== undefined) patch.title = data.title
    if (data.active !== undefined) patch.active = data.active
    const frame = await ignoreMissing(prisma.frame.update({ where: { id: data.id }, data: patch }))
    if (frame) io.to(`board:${data.boardId}`).emit('frame:updated', frame)
  })

  socket.on('frame:delete', async (data: { id: string; boardId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const deleted = await ignoreMissing(prisma.frame.delete({ where: { id: data.id } }))
    if (deleted) io.to(`board:${data.boardId}`).emit('frame:deleted', data.id)
  })

  socket.on('frame:layer', async (data: { id: string; boardId: string; layer: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const frame = await ignoreMissing(prisma.frame.update({ where: { id: data.id }, data: { layer: data.layer } }))
    if (frame) io.to(`board:${data.boardId}`).emit('frame:layered', { id: data.id, layer: data.layer })
  })

  // â”€â”€ Board fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('boardfield:create', async (data: { boardId: string; name: string; emoji?: string; type: string; options?: string[] | null; order?: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const field = await prisma.boardField.create({
      data: {
        boardId: data.boardId,
        name: data.name,
        emoji: data.emoji ?? null,
        type: data.type as never,
        options: data.options ?? undefined,
        order: data.order ?? 0,
      },
    })
    io.to(`board:${data.boardId}`).emit('boardfield:created', field)
  })

  socket.on('boardfield:update', async (data: { id: string; boardId: string; name: string; emoji?: string; options?: string[] | null }) => {
    if (!canWrite(socket, data.boardId)) return
    const field = await ignoreMissing(prisma.boardField.update({
      where: { id: data.id },
      data: { name: data.name, emoji: data.emoji ?? null, options: data.options ?? undefined },
    }))
    if (field) io.to(`board:${data.boardId}`).emit('boardfield:updated', field)
  })

  socket.on('boardfield:delete', async (data: { id: string; boardId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const deleted = await ignoreMissing(prisma.boardField.delete({ where: { id: data.id } }))
    if (deleted) io.to(`board:${data.boardId}`).emit('boardfield:deleted', data.id)
  })

  // â”€â”€ Card field values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('cardfield:set', async (data: { boardId: string; cardId: string; fieldId: string; value: string }) => {
    if (!canWrite(socket, data.boardId)) return
    // Upsert on a just-deleted card/field raises a FK violation â€” ignore it.
    const fv = await ignoreMissing(prisma.cardFieldValue.upsert({
      where: { cardId_fieldId: { cardId: data.cardId, fieldId: data.fieldId } },
      update: { value: data.value },
      create: { cardId: data.cardId, fieldId: data.fieldId, value: data.value },
    }))
    if (fv) io.to(`board:${data.boardId}`).emit('cardfield:updated', fv)
  })

  socket.on('cardfield:clear', async (data: { boardId: string; cardId: string; fieldId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    await prisma.cardFieldValue.deleteMany({ where: { cardId: data.cardId, fieldId: data.fieldId } })
    io.to(`board:${data.boardId}`).emit('cardfield:cleared', { cardId: data.cardId, fieldId: data.fieldId })
  })

  // â”€â”€ Timer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  socket.on('timer:start', (data: { boardId: string; duration: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const endsAt = Date.now() + data.duration * 1000
    io.to(`board:${data.boardId}`).emit('timer:started', { endsAt })
  })

  socket.on('timer:stop', (data: { boardId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    io.to(`board:${data.boardId}`).emit('timer:stopped')
  })
}
