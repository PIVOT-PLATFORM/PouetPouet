import { randomUUID } from 'crypto'
import type { Server, Socket } from 'socket.io'
import { prisma } from '../lib/prisma.js'

export function boardSocketHandlers(io: Server, socket: Socket) {
  // ── Board state ───────────────────────────────────────────────────────────────
  socket.on('board:join', async (boardId: string) => {
    await socket.join(`board:${boardId}`)
    const [cards, connections, frames, fields] = await Promise.all([
      prisma.card.findMany({ where: { boardId }, include: { fieldValues: true } }),
      prisma.cardConnection.findMany({ where: { boardId } }),
      prisma.frame.findMany({ where: { boardId } }),
      prisma.boardField.findMany({ where: { boardId }, orderBy: { order: 'asc' } }),
    ])
    socket.emit('board:state', { cards, connections, frames, fields })
  })

  socket.on('board:leave', (boardId: string) => {
    socket.leave(`board:${boardId}`)
  })

  // ── Cards ─────────────────────────────────────────────────────────────────────
  socket.on('card:create', async (data: { boardId: string; content: string; posX: number; posY: number; color?: string; type?: string; width?: number; height?: number }) => {
    const card = await prisma.card.create({ data: data as never, include: { fieldValues: true } })
    io.to(`board:${data.boardId}`).emit('card:created', card)
  })

  socket.on('card:move', async (data: { id: string; boardId: string; posX: number; posY: number }) => {
    const card = await prisma.card.update({ where: { id: data.id }, data: { posX: data.posX, posY: data.posY } })
    socket.to(`board:${data.boardId}`).emit('card:moved', card)
  })

  socket.on('card:resize', async (data: { id: string; boardId: string; width: number; height: number }) => {
    const card = await prisma.card.update({ where: { id: data.id }, data: { width: data.width, height: data.height } })
    socket.to(`board:${data.boardId}`).emit('card:resized', card)
  })

  socket.on('card:update', async (data: { id: string; boardId: string; content: string }) => {
    const card = await prisma.card.update({ where: { id: data.id }, data: { content: data.content } })
    io.to(`board:${data.boardId}`).emit('card:updated', card)
  })

  socket.on('card:delete', async (data: { id: string; boardId: string }) => {
    await prisma.card.delete({ where: { id: data.id } })
    io.to(`board:${data.boardId}`).emit('card:deleted', data.id)
  })

  socket.on('card:recolor', async (data: { id: string; boardId: string; color: string }) => {
    const card = await prisma.card.update({ where: { id: data.id }, data: { color: data.color } })
    io.to(`board:${data.boardId}`).emit('card:recolored', card)
  })

  // ── Groups ────────────────────────────────────────────────────────────────────
  socket.on('cards:group', async (data: { boardId: string; cardIds: string[] }) => {
    const groupId = randomUUID()
    await prisma.card.updateMany({ where: { id: { in: data.cardIds }, boardId: data.boardId }, data: { groupId } })
    io.to(`board:${data.boardId}`).emit('cards:grouped', { cardIds: data.cardIds, groupId })
  })

  socket.on('cards:ungroup', async (data: { boardId: string; groupId: string }) => {
    await prisma.card.updateMany({ where: { groupId: data.groupId, boardId: data.boardId }, data: { groupId: null } })
    io.to(`board:${data.boardId}`).emit('cards:ungrouped', data.groupId)
  })

  // ── Connections ───────────────────────────────────────────────────────────────
  socket.on('connection:create', async (data: { boardId: string; fromId: string; toId: string }) => {
    const existing = await prisma.cardConnection.findFirst({ where: { boardId: data.boardId, fromId: data.fromId, toId: data.toId } })
    if (existing) return
    const connection = await prisma.cardConnection.create({ data })
    io.to(`board:${data.boardId}`).emit('connection:created', connection)
  })

  socket.on('connection:delete', async (data: { id: string; boardId: string }) => {
    await prisma.cardConnection.delete({ where: { id: data.id } })
    io.to(`board:${data.boardId}`).emit('connection:deleted', data.id)
  })

  // ── Frames ────────────────────────────────────────────────────────────────────
  socket.on('frame:create', async (data: { boardId: string; posX: number; posY: number; title?: string; color?: string; width?: number; height?: number }) => {
    const frame = await prisma.frame.create({ data })
    io.to(`board:${data.boardId}`).emit('frame:created', frame)
  })

  socket.on('frame:move', async (data: { id: string; boardId: string; posX: number; posY: number }) => {
    const frame = await prisma.frame.update({ where: { id: data.id }, data: { posX: data.posX, posY: data.posY } })
    socket.to(`board:${data.boardId}`).emit('frame:moved', frame)
  })

  socket.on('frame:resize', async (data: { id: string; boardId: string; width: number; height: number }) => {
    const frame = await prisma.frame.update({ where: { id: data.id }, data: { width: data.width, height: data.height } })
    socket.to(`board:${data.boardId}`).emit('frame:resized', frame)
  })

  socket.on('frame:update', async (data: { id: string; boardId: string; title: string }) => {
    const frame = await prisma.frame.update({ where: { id: data.id }, data: { title: data.title } })
    io.to(`board:${data.boardId}`).emit('frame:updated', frame)
  })

  socket.on('frame:delete', async (data: { id: string; boardId: string }) => {
    await prisma.frame.delete({ where: { id: data.id } })
    io.to(`board:${data.boardId}`).emit('frame:deleted', data.id)
  })

  // ── Board fields ──────────────────────────────────────────────────────────────
  socket.on('boardfield:create', async (data: { boardId: string; name: string; emoji?: string; type: string; options?: string[] | null; order?: number }) => {
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
    const field = await prisma.boardField.update({
      where: { id: data.id },
      data: { name: data.name, emoji: data.emoji ?? null, options: data.options ?? undefined },
    })
    io.to(`board:${data.boardId}`).emit('boardfield:updated', field)
  })

  socket.on('boardfield:delete', async (data: { id: string; boardId: string }) => {
    await prisma.boardField.delete({ where: { id: data.id } })
    io.to(`board:${data.boardId}`).emit('boardfield:deleted', data.id)
  })

  // ── Card field values ─────────────────────────────────────────────────────────
  socket.on('cardfield:set', async (data: { boardId: string; cardId: string; fieldId: string; value: string }) => {
    const fv = await prisma.cardFieldValue.upsert({
      where: { cardId_fieldId: { cardId: data.cardId, fieldId: data.fieldId } },
      update: { value: data.value },
      create: { cardId: data.cardId, fieldId: data.fieldId, value: data.value },
    })
    io.to(`board:${data.boardId}`).emit('cardfield:updated', fv)
  })

  socket.on('cardfield:clear', async (data: { boardId: string; cardId: string; fieldId: string }) => {
    await prisma.cardFieldValue.deleteMany({ where: { cardId: data.cardId, fieldId: data.fieldId } })
    io.to(`board:${data.boardId}`).emit('cardfield:cleared', { cardId: data.cardId, fieldId: data.fieldId })
  })
}
