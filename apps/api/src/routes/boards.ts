import { randomBytes } from 'crypto'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { getIO } from '../lib/io.js'

const boardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

const roleSchema = z.enum(['VIEWER', 'EDITOR'])

async function getUserBoardRole(boardId: string, userId: string): Promise<'OWNER' | 'EDITOR' | 'VIEWER' | null> {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } })
  if (!board) return null
  if (board.ownerId === userId) return 'OWNER'
  const share = await prisma.boardShare.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { role: true },
  })
  return share ? (share.role as 'EDITOR' | 'VIEWER') : null
}

export const boardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // List boards (owned + shared)
  app.get('/', async (request) => {
    const { id } = request.user as { id: string }
    const [owned, shared] = await Promise.all([
      prisma.board.findMany({
        where: { ownerId: id },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { shares: true } } },
      }),
      prisma.boardShare.findMany({
        where: { userId: id },
        include: { board: { include: { _count: { select: { shares: true } } } } },
        orderBy: { board: { updatedAt: 'desc' } },
      }),
    ])
    return [
      ...owned.map((b) => ({ ...b, role: 'OWNER' as const, shareCount: b._count.shares })),
      ...shared.map((s) => ({ ...s.board, role: s.role, shareCount: s.board._count.shares })),
    ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  })

  // Connected user counts for all boards the requester has access to
  app.get('/presence', async (request) => {
    const { id: userId } = request.user as { id: string }
    const io = getIO()
    const [owned, shared] = await Promise.all([
      prisma.board.findMany({ where: { ownerId: userId }, select: { id: true } }),
      prisma.boardShare.findMany({ where: { userId }, select: { boardId: true } }),
    ])
    const boardIds = [...owned.map((b) => b.id), ...shared.map((s) => s.boardId)]
    if (!io || boardIds.length === 0) return {}
    const counts = await Promise.all(
      boardIds.map(async (boardId) => {
        const sockets = await io.in(`board:${boardId}`).fetchSockets()
        const unique = new Set(sockets.map((s) => s.data.userId as string).filter(Boolean))
        return [boardId, unique.size] as const
      })
    )
    return Object.fromEntries(counts)
  })

  // Create board
  app.post('/', async (request, reply) => {
    const { id } = request.user as { id: string }
    const body = boardSchema.parse(request.body)
    const board = await prisma.board.create({ data: { ...body, ownerId: id } })
    return reply.status(201).send({ ...board, role: 'OWNER' })
  })

  // Join via share link
  app.post('/join', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { token } = z.object({ token: z.string() }).parse(request.body)
    const board = await prisma.board.findUnique({ where: { shareToken: token } })
    if (!board) return reply.status(404).send({ error: 'Lien invalide ou expiré' })
    if (board.ownerId === userId) return reply.send({ boardId: board.id, role: 'OWNER' })
    await prisma.boardShare.upsert({
      where: { boardId_userId: { boardId: board.id, userId } },
      update: {},
      create: { boardId: board.id, userId, role: board.shareLinkRole },
    })
    const share = await prisma.boardShare.findUnique({
      where: { boardId_userId: { boardId: board.id, userId } },
    })
    return reply.send({ boardId: board.id, role: share?.role ?? board.shareLinkRole })
  })

  // Get single board
  app.get('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const board = await prisma.board.findUnique({
      where: { id },
      include: { cards: { include: { fieldValues: true } } },
    })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    const role = await getUserBoardRole(id, userId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    return reply.send({ ...board, role })
  })

  // Delete board (owner only)
  app.delete('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (board.ownerId !== userId) return reply.status(403).send({ error: 'Accès refusé' })
    await prisma.board.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── Members ───────────────────────────────────────────────────────────────────

  // Get all members with access (any role)
  app.get('/:id/members', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const role = await getUserBoardRole(id, userId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    const board = await prisma.board.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, avatar: true } },
        shares: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    return [
      { id: board.owner.id, name: board.owner.name, avatar: board.owner.avatar, role: 'OWNER' as const },
      ...board.shares.map((s) => ({
        id: s.user.id,
        name: s.user.name,
        avatar: s.user.avatar,
        role: s.role as 'EDITOR' | 'VIEWER',
      })),
    ]
  })

  // ── Share management ──────────────────────────────────────────────────────────

  // Get share info (owner only)
  app.get('/:id/shares', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (board.ownerId !== userId) return reply.status(403).send({ error: 'Accès refusé' })
    const shares = await prisma.boardShare.findMany({
      where: { boardId: id },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ shares, shareToken: board.shareToken, shareLinkRole: board.shareLinkRole })
  })

  // Enable / regenerate share link (owner only)
  app.post('/:id/shares/link', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = z.object({ role: roleSchema.default('VIEWER') }).parse(request.body)
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (board.ownerId !== userId) return reply.status(403).send({ error: 'Accès refusé' })
    const shareToken = randomBytes(16).toString('hex')
    const updated = await prisma.board.update({
      where: { id },
      data: { shareToken, shareLinkRole: role },
    })
    return reply.send({ shareToken: updated.shareToken, shareLinkRole: updated.shareLinkRole })
  })

  // Update share link role (owner only)
  app.patch('/:id/shares/link', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { role } = z.object({ role: roleSchema }).parse(request.body)
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (board.ownerId !== userId) return reply.status(403).send({ error: 'Accès refusé' })
    const updated = await prisma.board.update({ where: { id }, data: { shareLinkRole: role } })
    return reply.send({ shareToken: updated.shareToken, shareLinkRole: updated.shareLinkRole })
  })

  // Disable share link (owner only)
  app.delete('/:id/shares/link', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (board.ownerId !== userId) return reply.status(403).send({ error: 'Accès refusé' })
    await prisma.board.update({ where: { id }, data: { shareToken: null } })
    return reply.status(204).send()
  })

  // Invite user by email (owner only)
  app.post('/:id/shares/invite', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { email, role } = z.object({ email: z.string().email(), role: roleSchema.default('VIEWER') }).parse(request.body)
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (board.ownerId !== userId) return reply.status(403).send({ error: 'Accès refusé' })
    const invitedUser = await prisma.user.findUnique({ where: { email } })
    if (!invitedUser) return reply.status(404).send({ error: 'Aucun compte trouvé avec cet email' })
    if (invitedUser.id === userId) return reply.status(400).send({ error: 'Vous ne pouvez pas vous inviter vous-même' })
    if (invitedUser.id === board.ownerId) return reply.status(400).send({ error: 'Cet utilisateur est déjà propriétaire du board' })
    const share = await prisma.boardShare.upsert({
      where: { boardId_userId: { boardId: id, userId: invitedUser.id } },
      update: { role },
      create: { boardId: id, userId: invitedUser.id, role },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    })
    return reply.status(201).send(share)
  })

  // Update share role (owner only)
  app.patch('/:id/shares/:shareId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, shareId } = request.params as { id: string; shareId: string }
    const { role } = z.object({ role: roleSchema }).parse(request.body)
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (board.ownerId !== userId) return reply.status(403).send({ error: 'Accès refusé' })
    const share = await prisma.boardShare.update({
      where: { id: shareId },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    })
    return reply.send(share)
  })

  // Revoke share (owner only)
  app.delete('/:id/shares/:shareId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, shareId } = request.params as { id: string; shareId: string }
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (board.ownerId !== userId) return reply.status(403).send({ error: 'Accès refusé' })
    await prisma.boardShare.delete({ where: { id: shareId } })
    return reply.status(204).send()
  })
}
