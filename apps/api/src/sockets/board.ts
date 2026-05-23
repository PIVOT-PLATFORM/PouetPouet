import { randomUUID } from 'crypto'
import type { Server, Socket } from 'socket.io'
import { prisma } from '../lib/prisma.js'

function canWrite(socket: Socket, boardId: string): boolean {
  const role = socket.data.boardRoles?.[boardId]
  return role === 'OWNER' || role === 'EDITOR'
}

async function broadcastPresence(io: Server, boardId: string) {
  const sockets = await io.in(`board:${boardId}`).fetchSockets()
  const seen = new Set<string>()
  const users: { id: string; name: string; avatar: string | null }[] = []
  for (const s of sockets) {
    const info = s.data.userInfo as { id: string; name: string; avatar: string | null } | undefined
    if (info && !seen.has(info.id)) {
      seen.add(info.id)
      users.push(info)
    }
  }
  io.to(`board:${boardId}`).emit('board:presence', users)
}

export function boardSocketHandlers(io: Server, socket: Socket) {
  // ── Board state ───────────────────────────────────────────────────────────────
  socket.on('board:join', async (boardId: string) => {
    const userId: string = socket.data.userId
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

    if (!role) { socket.emit('board:error', 'Accès refusé'); return }

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
    await broadcastPresence(io, boardId)
  })

  socket.on('board:leave', async (boardId: string) => {
    socket.leave(`board:${boardId}`)
    await broadcastPresence(io, boardId)
  })

  socket.on('disconnect', async () => {
    const boardRoles = socket.data.boardRoles as Record<string, string> | undefined
    if (!boardRoles) return
    for (const boardId of Object.keys(boardRoles)) {
      await broadcastPresence(io, boardId)
    }
  })

  // ── Cards ─────────────────────────────────────────────────────────────────────
  socket.on('card:create', async (data: { boardId: string; content: string; posX: number; posY: number; color?: string; type?: string; width?: number; height?: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await prisma.card.create({ data: data as never, include: { fieldValues: true } })
    io.to(`board:${data.boardId}`).emit('card:created', card)
  })

  socket.on('card:move', async (data: { id: string; boardId: string; posX: number; posY: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await prisma.card.update({ where: { id: data.id }, data: { posX: data.posX, posY: data.posY } })
    socket.to(`board:${data.boardId}`).emit('card:moved', card)
  })

  socket.on('card:resize', async (data: { id: string; boardId: string; width: number; height: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await prisma.card.update({ where: { id: data.id }, data: { width: data.width, height: data.height } })
    socket.to(`board:${data.boardId}`).emit('card:resized', card)
  })

  socket.on('card:update', async (data: { id: string; boardId: string; content: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await prisma.card.update({ where: { id: data.id }, data: { content: data.content } })
    io.to(`board:${data.boardId}`).emit('card:updated', card)
  })

  socket.on('card:delete', async (data: { id: string; boardId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    await prisma.card.delete({ where: { id: data.id } })
    io.to(`board:${data.boardId}`).emit('card:deleted', data.id)
  })

  socket.on('card:recolor', async (data: { id: string; boardId: string; color: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const card = await prisma.card.update({ where: { id: data.id }, data: { color: data.color } })
    io.to(`board:${data.boardId}`).emit('card:recolored', card)
  })

  socket.on('card:lock', async (data: { ids: string[]; boardId: string; locked: boolean }) => {
    if (!canWrite(socket, data.boardId)) return
    await prisma.card.updateMany({ where: { id: { in: data.ids }, boardId: data.boardId }, data: { locked: data.locked } })
    io.to(`board:${data.boardId}`).emit('cards:locked', { ids: data.ids, locked: data.locked })
  })

  // ── Groups ────────────────────────────────────────────────────────────────────
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

  // ── Connections ───────────────────────────────────────────────────────────────
  socket.on('connection:create', async (data: { boardId: string; fromId: string; toId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const existing = await prisma.cardConnection.findFirst({ where: { boardId: data.boardId, fromId: data.fromId, toId: data.toId } })
    if (existing) return
    const connection = await prisma.cardConnection.create({ data })
    io.to(`board:${data.boardId}`).emit('connection:created', connection)
  })

  socket.on('connection:delete', async (data: { id: string; boardId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    await prisma.cardConnection.delete({ where: { id: data.id } })
    io.to(`board:${data.boardId}`).emit('connection:deleted', data.id)
  })

  // ── Frames ────────────────────────────────────────────────────────────────────
  socket.on('frame:create', async (data: { boardId: string; posX: number; posY: number; title?: string; color?: string; width?: number; height?: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const frame = await prisma.frame.create({ data })
    io.to(`board:${data.boardId}`).emit('frame:created', frame)
  })

  socket.on('frame:move', async (data: { id: string; boardId: string; posX: number; posY: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const frame = await prisma.frame.update({ where: { id: data.id }, data: { posX: data.posX, posY: data.posY } })
    socket.to(`board:${data.boardId}`).emit('frame:moved', frame)
  })

  socket.on('frame:resize', async (data: { id: string; boardId: string; width: number; height: number }) => {
    if (!canWrite(socket, data.boardId)) return
    const frame = await prisma.frame.update({ where: { id: data.id }, data: { width: data.width, height: data.height } })
    socket.to(`board:${data.boardId}`).emit('frame:resized', frame)
  })

  socket.on('frame:update', async (data: { id: string; boardId: string; title: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const frame = await prisma.frame.update({ where: { id: data.id }, data: { title: data.title } })
    io.to(`board:${data.boardId}`).emit('frame:updated', frame)
  })

  socket.on('frame:delete', async (data: { id: string; boardId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    await prisma.frame.delete({ where: { id: data.id } })
    io.to(`board:${data.boardId}`).emit('frame:deleted', data.id)
  })

  // ── Board fields ──────────────────────────────────────────────────────────────
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
    const field = await prisma.boardField.update({
      where: { id: data.id },
      data: { name: data.name, emoji: data.emoji ?? null, options: data.options ?? undefined },
    })
    io.to(`board:${data.boardId}`).emit('boardfield:updated', field)
  })

  socket.on('boardfield:delete', async (data: { id: string; boardId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    await prisma.boardField.delete({ where: { id: data.id } })
    io.to(`board:${data.boardId}`).emit('boardfield:deleted', data.id)
  })

  // ── Card field values ─────────────────────────────────────────────────────────
  socket.on('cardfield:set', async (data: { boardId: string; cardId: string; fieldId: string; value: string }) => {
    if (!canWrite(socket, data.boardId)) return
    const fv = await prisma.cardFieldValue.upsert({
      where: { cardId_fieldId: { cardId: data.cardId, fieldId: data.fieldId } },
      update: { value: data.value },
      create: { cardId: data.cardId, fieldId: data.fieldId, value: data.value },
    })
    io.to(`board:${data.boardId}`).emit('cardfield:updated', fv)
  })

  socket.on('cardfield:clear', async (data: { boardId: string; cardId: string; fieldId: string }) => {
    if (!canWrite(socket, data.boardId)) return
    await prisma.cardFieldValue.deleteMany({ where: { cardId: data.cardId, fieldId: data.fieldId } })
    io.to(`board:${data.boardId}`).emit('cardfield:cleared', { cardId: data.cardId, fieldId: data.fieldId })
  })

  // ── Timer ─────────────────────────────────────────────────────────────────────
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
