import { randomBytes, randomUUID } from 'crypto'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { getIO } from '../../lib/io.js'
import { notify } from '../../lib/notify.js'
import { bus } from '../../lib/bus.js'

const ROLE_LABEL = { VIEWER: 'lecteur', EDITOR: 'éditeur', OWNER: 'propriétaire' } as const

const boardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  coverImage: z.string().nullable().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  enabledActivities: z.array(z.string()).nullable().optional(),
  templateId: z.string().optional(),
})

const boardUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  enabledActivities: z.array(z.string()).nullable().optional(),
})

const roleSchema = z.enum(['VIEWER', 'EDITOR', 'OWNER'])
// Le lien public ne peut jamais conférer la propriété (n'importe qui peut le suivre)
const linkRoleSchema = z.enum(['VIEWER', 'EDITOR'])

async function getUserBoardRole(boardId: string, userId: string): Promise<'OWNER' | 'EDITOR' | 'VIEWER' | null> {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { ownerId: true } })
  if (!board) return null
  if (board.ownerId === userId) return 'OWNER'
  const share = await prisma.boardShare.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { role: true },
  })
  return share ? (share.role as 'OWNER' | 'EDITOR' | 'VIEWER') : null
}

// Propriétaire effectif : le créateur (Board.ownerId) OU un co-propriétaire
// (partage avec rôle OWNER). Le créateur n'a pas de ligne de partage : il ne
// peut donc être ni rétrogradé ni retiré par un co-propriétaire.
async function isBoardOwner(board: { id: string; ownerId: string }, userId: string): Promise<boolean> {
  if (board.ownerId === userId) return true
  const share = await prisma.boardShare.findUnique({
    where: { boardId_userId: { boardId: board.id, userId } },
    select: { role: true },
  })
  return share?.role === 'OWNER'
}

// OWNER ou EDITOR peut gérer les partages (invitations, rôles, révocations)
// Retourne le rôle effectif du demandeur, ou null si pas accès.
async function canManageShares(board: { id: string; ownerId: string }, userId: string): Promise<'OWNER' | 'EDITOR' | null> {
  if (board.ownerId === userId) return 'OWNER'
  const share = await prisma.boardShare.findUnique({
    where: { boardId_userId: { boardId: board.id, userId } },
    select: { role: true },
  })
  if (share?.role === 'OWNER') return 'OWNER'
  if (share?.role === 'EDITOR') return 'EDITOR'
  return null
}

export const boardRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // List boards (owned + shared)
  app.get('/', async (request) => {
    const { id } = request.user as { id: string }
    const [owned, shared, favorites] = await Promise.all([
      prisma.board.findMany({
        where: { ownerId: id, templateDraftOf: null },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { shares: true } } },
      }),
      prisma.boardShare.findMany({
        where: { userId: id },
        include: { board: { include: { _count: { select: { shares: true } } } } },
        orderBy: { board: { updatedAt: 'desc' } },
      }),
      prisma.boardFavorite.findMany({ where: { userId: id }, select: { boardId: true } }),
    ])
    const favSet = new Set(favorites.map((f) => f.boardId))
    return [
      ...owned.map((b) => ({ ...b, role: 'OWNER' as const, shareCount: b._count.shares, isFavorite: favSet.has(b.id) })),
      ...shared.map((s) => ({ ...s.board, role: s.role, shareCount: s.board._count.shares, isFavorite: favSet.has(s.board.id) })),
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

  // Create board (optionally from template)
  app.post('/', async (request, reply) => {
    const { id } = request.user as { id: string }
    const body = boardSchema.parse(request.body)
    const { templateId, ...rest } = body

    let template: any = null
    if (templateId) {
      template = await prisma.boardTemplate.findUnique({ where: { id: templateId } })
      if (!template) return reply.status(404).send({ error: 'Template introuvable' })
      if (template.ownerId !== id) return reply.status(403).send({ error: 'Accès refusé' })
    }

    const board = await prisma.board.create({
      data: {
        name: rest.name,
        description: rest.description ?? template?.description ?? null,
        coverImage: rest.coverImage ?? template?.coverImage ?? null,
        maxParticipants: rest.maxParticipants ?? template?.maxParticipants ?? null,
        enabledActivities: (rest.enabledActivities ?? template?.enabledActivities ?? undefined) as never,
        ownerId: id,
      },
    })

    if (template) {
      const cards = (template.cards as any[]) ?? []
      const frames = (template.frames as any[]) ?? []
      const connections = (template.connections as any[]) ?? []
      const fields = (template.fields as any[]) ?? []

      // Map old card ids to new ones (for connection rewiring)
      const cardIdMap = new Map<string, string>()
      for (const c of cards) {
        const created = await prisma.card.create({
          data: {
            boardId: board.id,
            type: c.type ?? 'TEXT',
            content: c.content ?? '',
            posX: c.posX ?? 0,
            posY: c.posY ?? 0,
            width: c.width ?? 192,
            height: c.height ?? 128,
            color: c.color ?? '#FFEB3B',
          },
        })
        cardIdMap.set(c.id as string, created.id)
      }
      if (frames.length > 0) {
        await prisma.frame.createMany({
          data: frames.map((f) => ({
            boardId: board.id,
            title: f.title ?? 'Cadre',
            posX: f.posX ?? 0,
            posY: f.posY ?? 0,
            width: f.width ?? 400,
            height: f.height ?? 300,
            color: f.color ?? '#E0E7FF',
            active: f.active ?? false,
          })),
        })
      }
      if (fields.length > 0) {
        await prisma.boardField.createMany({
          data: fields.map((f) => ({
            boardId: board.id,
            name: f.name,
            emoji: f.emoji ?? null,
            type: f.type ?? 'TEXT',
            options: f.options ?? undefined,
            order: f.order ?? 0,
          })),
        })
      }
      if (connections.length > 0) {
        const remapped = connections
          .map((cn) => ({ fromId: cardIdMap.get(cn.fromId), toId: cardIdMap.get(cn.toId) }))
          .filter((cn) => cn.fromId && cn.toId)
        if (remapped.length > 0) {
          await prisma.cardConnection.createMany({
            data: remapped.map((cn) => ({ boardId: board.id, fromId: cn.fromId!, toId: cn.toId! })),
          })
        }
      }
    }

    return reply.status(201).send({ ...board, role: 'OWNER', shareCount: 0, isFavorite: false })
  })

  // Update board (owner only)
  app.patch('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const body = boardUpdateSchema.parse(request.body)
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (!(await isBoardOwner(board, userId))) return reply.status(403).send({ error: 'Accès refusé' })
    const updated = await prisma.board.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.coverImage !== undefined && { coverImage: body.coverImage }),
        ...(body.maxParticipants !== undefined && { maxParticipants: body.maxParticipants }),
        ...(body.enabledActivities !== undefined && { enabledActivities: (body.enabledActivities ?? undefined) as never }),
      },
    })
    return reply.send(updated)
  })

  // Toggle favorite
  app.post('/:id/favorite', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const role = await getUserBoardRole(id, userId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    await prisma.boardFavorite.upsert({
      where: { userId_boardId: { userId, boardId: id } },
      update: {},
      create: { userId, boardId: id },
    })
    return reply.send({ isFavorite: true })
  })

  app.delete('/:id/favorite', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    await prisma.boardFavorite.deleteMany({ where: { userId, boardId: id } })
    return reply.send({ isFavorite: false })
  })

  // Join via share link
  app.post('/join', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { token } = z.object({ token: z.string() }).parse(request.body)
    const board = await prisma.board.findUnique({ where: { shareToken: token } })
    if (!board) return reply.status(404).send({ error: 'Lien invalide ou expiré' })
    if (board.ownerId === userId) return reply.send({ boardId: board.id, role: 'OWNER' })
    // upsert renvoie déjà la ligne (créée ou existante) : pas de re-lecture.
    const share = await prisma.boardShare.upsert({
      where: { boardId_userId: { boardId: board.id, userId } },
      update: {},
      create: { boardId: board.id, userId, role: board.shareLinkRole },
    })
    return reply.send({ boardId: board.id, role: share.role })
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
    // Le board est déjà chargé (ownerId inclus) : on évite le re-fetch de
    // getUserBoardRole et, pour le propriétaire, la requête de partage.
    let role: 'OWNER' | 'EDITOR' | 'VIEWER' | null
    if (board.ownerId === userId) {
      role = 'OWNER'
    } else {
      const share = await prisma.boardShare.findUnique({
        where: { boardId_userId: { boardId: id, userId } },
        select: { role: true },
      })
      role = share ? (share.role as 'OWNER' | 'EDITOR' | 'VIEWER') : null
    }
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    return reply.send({ ...board, role })
  })

  // Delete board (owner only)
  app.delete('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (!(await isBoardOwner(board, userId))) return reply.status(403).send({ error: 'Accès refusé' })
    // Capture who had access before the cascade wipes the shares, so we can notify them.
    const shares = await prisma.boardShare.findMany({ where: { boardId: id }, select: { userId: true } })
    await prisma.board.delete({ where: { id } })
    await Promise.all(
      shares.map((s) =>
        notify({
          userId: s.userId,
          type: 'BOARD_DELETED',
          title: `Le board « ${board.name} » a été supprimé`,
          body: 'Son propriétaire a supprimé ce board partagé.',
          link: null,
        })
      )
    )
    return reply.status(204).send()
  })

  // â”€â”€ Members â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        role: s.role as 'OWNER' | 'EDITOR' | 'VIEWER',
      })),
    ]
  })

  // â”€â”€ Share management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Get share info (owner or editor)
  app.get('/:id/shares', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (!(await canManageShares(board, userId))) return reply.status(403).send({ error: 'Accès refusé' })
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
    const { role } = z.object({ role: linkRoleSchema.default('VIEWER') }).parse(request.body)
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (!(await isBoardOwner(board, userId))) return reply.status(403).send({ error: 'Accès refusé' })
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
    const { role } = z.object({ role: linkRoleSchema }).parse(request.body)
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (!(await isBoardOwner(board, userId))) return reply.status(403).send({ error: 'Accès refusé' })
    const updated = await prisma.board.update({ where: { id }, data: { shareLinkRole: role } })
    return reply.send({ shareToken: updated.shareToken, shareLinkRole: updated.shareLinkRole })
  })

  // Disable share link (owner only)
  app.delete('/:id/shares/link', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    if (!(await isBoardOwner(board, userId))) return reply.status(403).send({ error: 'Accès refusé' })
    await prisma.board.update({ where: { id }, data: { shareToken: null } })
    return reply.status(204).send()
  })

  // Invite user by email (owner or editor; editor cannot grant OWNER)
  app.post('/:id/shares/invite', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const { email, role } = z.object({ email: z.string().email(), role: roleSchema.default('VIEWER') }).parse(request.body)
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    const managerRole = await canManageShares(board, userId)
    if (!managerRole) return reply.status(403).send({ error: 'Accès refusé' })
    if (managerRole === 'EDITOR' && role === 'OWNER') return reply.status(403).send({ error: 'Un éditeur ne peut pas attribuer le rôle propriétaire' })
    const invitedUser = await prisma.user.findUnique({ where: { email } })
    if (!invitedUser) return reply.status(404).send({ error: 'Aucun compte trouvé avec cet email' })
    if (invitedUser.id === userId) return reply.status(400).send({ error: 'Vous ne pouvez pas vous inviter vous-même' })
    if (invitedUser.id === board.ownerId) return reply.status(400).send({ error: 'Cet utilisateur est déjà  propriétaire du board' })
    const existing = await prisma.boardShare.findUnique({
      where: { boardId_userId: { boardId: id, userId: invitedUser.id } },
    })
    const share = await prisma.boardShare.upsert({
      where: { boardId_userId: { boardId: id, userId: invitedUser.id } },
      update: { role },
      create: { boardId: id, userId: invitedUser.id, role },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    })
    if (!existing) {
      await notify({
        userId: invitedUser.id,
        type: 'BOARD_SHARED',
        title: `« ${board.name} » a été partagé avec vous`,
        body: `Vous avez accès en tant que ${ROLE_LABEL[role]}.`,
        link: `/boards/${board.id}`,
      })
    } else if (existing.role !== role) {
      await notify({
        userId: invitedUser.id,
        type: 'ROLE_CHANGED',
        title: `Votre rôle sur « ${board.name} » a changé`,
        body: `Vous êtes désormais ${ROLE_LABEL[role]}.`,
        link: `/boards/${board.id}`,
      })
    }
    return reply.status(201).send(share)
  })

  // Update share role (owner or editor; editor cannot touch OWNER shares or grant OWNER)
  app.patch('/:id/shares/:shareId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, shareId } = request.params as { id: string; shareId: string }
    const { role } = z.object({ role: roleSchema }).parse(request.body)
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    const managerRole = await canManageShares(board, userId)
    if (!managerRole) return reply.status(403).send({ error: 'Accès refusé' })
    if (managerRole === 'EDITOR') {
      if (role === 'OWNER') return reply.status(403).send({ error: 'Un éditeur ne peut pas attribuer le rôle propriétaire' })
      const targetShare = await prisma.boardShare.findUnique({ where: { id: shareId }, select: { role: true } })
      if (targetShare?.role === 'OWNER') return reply.status(403).send({ error: 'Un éditeur ne peut pas modifier le rôle d\'un propriétaire' })
    }
    const share = await prisma.boardShare.update({
      where: { id: shareId },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    })
    await notify({
      userId: share.userId,
      type: 'ROLE_CHANGED',
      title: `Votre rôle sur « ${board.name} » a changé`,
      body: `Vous êtes désormais ${ROLE_LABEL[role]}.`,
      link: `/boards/${board.id}`,
    })
    return reply.send(share)
  })

  // Revoke share (owner or editor; editor cannot revoke OWNER shares)
  app.delete('/:id/shares/:shareId', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id, shareId } = request.params as { id: string; shareId: string }
    const board = await prisma.board.findUnique({ where: { id } })
    if (!board) return reply.status(404).send({ error: 'Board introuvable' })
    const managerRole = await canManageShares(board, userId)
    if (!managerRole) return reply.status(403).send({ error: 'Accès refusé' })
    const share = await prisma.boardShare.findUnique({ where: { id: shareId }, select: { userId: true, role: true } })
    if (managerRole === 'EDITOR' && share?.role === 'OWNER') return reply.status(403).send({ error: 'Un éditeur ne peut pas révoquer l\'accès d\'un propriétaire' })
    await prisma.boardShare.delete({ where: { id: shareId } })
    if (share) {
      await notify({
        userId: share.userId,
        type: 'ACCESS_REVOKED',
        title: `Votre accès à  « ${board.name} » a été retiré`,
        body: null,
        link: null,
      })
    }
    return reply.status(204).send()
  })

  // â”€â”€ Vote sessions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Active vote session (any role)
  app.get('/:id/vote/current', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const role = await getUserBoardRole(id, userId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    const session = await prisma.boardVoteSession.findFirst({
      where: { boardId: id, status: 'ACTIVE' },
      include: { votes: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(session ?? null)
  })

  // â”€â”€ Klaxoon import â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.post('/:id/import/klaxoon', { bodyLimit: 50 * 1024 * 1024, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const role = await getUserBoardRole(id, userId)
    if (!role || role === 'VIEWER') return reply.status(403).send({ error: 'Accès refusé' })

    const body = z.object({
      cards: z.array(z.object({
        klxId: z.string(),
        type: z.enum(['TEXT', 'LABEL', 'DRAW', 'IMAGE', 'SHAPE']),
        content: z.string(),
        color: z.string(),
        posX: z.number(),
        posY: z.number(),
        width: z.number(),
        height: z.number(),
        zIndex: z.number(),
        locked: z.boolean(),
        groupKey: z.string().nullish(),
      })),
      connections: z.array(z.object({
        fromKlxId: z.string(),
        toKlxId: z.string(),
        shape: z.string(),
        color: z.string(),
        width: z.number(),
        dashed: z.boolean(),
        arrow: z.string(),
        label: z.string(),
      })),
    }).parse(request.body)

    // Remap each Klaxoon group key to a fresh server-side groupId so repeated
    // imports stay isolated and never collide with existing groups on the board.
    const groupIdMap = new Map<string, string>()
    for (const c of body.cards) {
      if (c.groupKey && !groupIdMap.has(c.groupKey)) groupIdMap.set(c.groupKey, randomUUID())
    }

    const createdCards = await prisma.$transaction(
      body.cards.map((c) =>
        prisma.card.create({
          data: { boardId: id, type: c.type as never, content: c.content, color: c.color, posX: c.posX, posY: c.posY, width: c.width, height: c.height, groupId: c.groupKey ? groupIdMap.get(c.groupKey) : null },
          include: { fieldValues: true },
        })
      )
    )

    // Build klxId â†’ real card id map
    const idMap = new Map<string, string>()
    body.cards.forEach((c, i) => idMap.set(c.klxId, createdCards[i].id))

    const validConns = body.connections.filter(
      (c) => idMap.has(c.fromKlxId) && idMap.has(c.toKlxId)
    )
    const createdConns = validConns.length > 0
      ? await prisma.$transaction(
          validConns.map((c) =>
            prisma.cardConnection.create({
              data: {
                boardId: id,
                fromId: idMap.get(c.fromKlxId)!,
                toId: idMap.get(c.toKlxId)!,
                shape: c.shape,
                color: c.color,
                width: c.width,
                dashed: c.dashed,
                arrow: c.arrow,
                label: c.label || null,
              },
            })
          )
        )
      : []

    const io = getIO()
    io?.to(`board:${id}`).emit('board:imported', { cards: createdCards, connections: createdConns })

    bus.publish({
      type: 'pouetpouet.board.imported',
      module: 'pouetpouet',
      actorId: userId,
      payload: { boardId: id, source: 'klaxoon', cards: createdCards.length, connections: createdConns.length },
    })

    return reply.status(201).send({ cards: createdCards.length, connections: createdConns.length })
  })

  // Last closed vote session (any role)
  app.get('/:id/vote/last', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const role = await getUserBoardRole(id, userId)
    if (!role) return reply.status(403).send({ error: 'Accès refusé' })
    const session = await prisma.boardVoteSession.findFirst({
      where: { boardId: id, status: 'CLOSED' },
      include: { votes: true },
      orderBy: { closedAt: 'desc' },
    })
    return reply.send(session ?? null)
  })
}
