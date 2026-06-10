import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'

const templateCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  enabledActivities: z.array(z.string()).nullable().optional(),
  // Either snapshot directly, or save from existing board
  fromBoardId: z.string().optional(),
})

const templateUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  maxParticipants: z.number().int().positive().nullable().optional(),
  enabledActivities: z.array(z.string()).nullable().optional(),
  isFavorite: z.boolean().optional(),
})

export const templateRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // List user templates (favorites first)
  app.get('/', async (request) => {
    const { id } = request.user as { id: string }
    const templates = await prisma.boardTemplate.findMany({
      where: { ownerId: id },
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
    })
    return templates
  })

  // Create template (from scratch or from a board snapshot)
  app.post('/', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const body = templateCreateSchema.parse(request.body)

    let cards: any[] = []
    let frames: any[] = []
    let connections: any[] = []
    let fields: any[] = []
    let inheritedDesc: string | null | undefined = body.description
    let inheritedCover: string | null | undefined = body.coverImage
    let inheritedMax: number | null | undefined = body.maxParticipants
    let inheritedActivities: any = body.enabledActivities

    if (body.fromBoardId) {
      const board = await prisma.board.findUnique({ where: { id: body.fromBoardId } })
      if (!board) return reply.status(404).send({ error: 'Board introuvable' })
      if (board.ownerId !== userId) return reply.status(403).send({ error: 'AccÃ¨s refusÃ©' })
      const [bCards, bFrames, bConns, bFields] = await Promise.all([
        prisma.card.findMany({ where: { boardId: board.id } }),
        prisma.frame.findMany({ where: { boardId: board.id } }),
        prisma.cardConnection.findMany({ where: { boardId: board.id } }),
        prisma.boardField.findMany({ where: { boardId: board.id }, orderBy: { order: 'asc' } }),
      ])
      cards = bCards
      frames = bFrames
      connections = bConns
      fields = bFields
      if (inheritedDesc === undefined) inheritedDesc = board.description
      if (inheritedCover === undefined) inheritedCover = board.coverImage
      if (inheritedMax === undefined) inheritedMax = board.maxParticipants
      if (inheritedActivities === undefined) inheritedActivities = board.enabledActivities
    }

    const template = await prisma.boardTemplate.create({
      data: {
        name: body.name,
        description: inheritedDesc ?? null,
        coverImage: inheritedCover ?? null,
        maxParticipants: inheritedMax ?? null,
        enabledActivities: (inheritedActivities ?? undefined) as never,
        ownerId: userId,
        cards: cards as never,
        frames: frames as never,
        connections: connections as never,
        fields: fields as never,
      },
    })
    return reply.status(201).send(template)
  })

  // Update template metadata
  app.patch('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const body = templateUpdateSchema.parse(request.body)
    const tpl = await prisma.boardTemplate.findUnique({ where: { id } })
    if (!tpl) return reply.status(404).send({ error: 'Template introuvable' })
    if (tpl.ownerId !== userId) return reply.status(403).send({ error: 'AccÃ¨s refusÃ©' })
    const updated = await prisma.boardTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.coverImage !== undefined && { coverImage: body.coverImage }),
        ...(body.maxParticipants !== undefined && { maxParticipants: body.maxParticipants }),
        ...(body.enabledActivities !== undefined && { enabledActivities: (body.enabledActivities ?? undefined) as never }),
        ...(body.isFavorite !== undefined && { isFavorite: body.isFavorite }),
      },
    })
    return reply.send(updated)
  })

  // Delete template
  app.delete('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const tpl = await prisma.boardTemplate.findUnique({ where: { id } })
    if (!tpl) return reply.status(404).send({ error: 'Template introuvable' })
    if (tpl.ownerId !== userId) return reply.status(403).send({ error: 'AccÃ¨s refusÃ©' })
    await prisma.boardTemplate.delete({ where: { id } })
    return reply.status(204).send()
  })

  // â”€â”€ Template content edition via draft board â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Create or reuse a draft board populated with the template's content
  app.post('/:id/edit-content', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const tpl = await prisma.boardTemplate.findUnique({ where: { id } })
    if (!tpl) return reply.status(404).send({ error: 'Template introuvable' })
    if (tpl.ownerId !== userId) return reply.status(403).send({ error: 'AccÃ¨s refusÃ©' })

    // Reuse existing draft if any
    const existing = await prisma.board.findFirst({ where: { ownerId: userId, templateDraftOf: id } })
    if (existing) return reply.send({ boardId: existing.id })

    const board = await prisma.board.create({
      data: {
        name: `[Template] ${tpl.name}`,
        description: tpl.description,
        coverImage: tpl.coverImage,
        maxParticipants: tpl.maxParticipants,
        enabledActivities: (tpl.enabledActivities ?? undefined) as never,
        ownerId: userId,
        templateDraftOf: id,
      },
    })

    const cards = (tpl.cards as any[]) ?? []
    const frames = (tpl.frames as any[]) ?? []
    const connections = (tpl.connections as any[]) ?? []
    const fields = (tpl.fields as any[]) ?? []

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

    return reply.send({ boardId: board.id })
  })

  // Save the draft board's content back into the template, delete the draft
  app.post('/:id/save-from-draft', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const tpl = await prisma.boardTemplate.findUnique({ where: { id } })
    if (!tpl) return reply.status(404).send({ error: 'Template introuvable' })
    if (tpl.ownerId !== userId) return reply.status(403).send({ error: 'AccÃ¨s refusÃ©' })

    const draft = await prisma.board.findFirst({ where: { ownerId: userId, templateDraftOf: id } })
    if (!draft) return reply.status(404).send({ error: 'Aucun brouillon trouvÃ©' })

    const [cards, frames, connections, fields] = await Promise.all([
      prisma.card.findMany({ where: { boardId: draft.id } }),
      prisma.frame.findMany({ where: { boardId: draft.id } }),
      prisma.cardConnection.findMany({ where: { boardId: draft.id } }),
      prisma.boardField.findMany({ where: { boardId: draft.id }, orderBy: { order: 'asc' } }),
    ])

    const updated = await prisma.boardTemplate.update({
      where: { id },
      data: {
        name: draft.name.replace(/^\[Template\]\s*/, ''),
        description: draft.description,
        coverImage: draft.coverImage,
        maxParticipants: draft.maxParticipants,
        enabledActivities: (draft.enabledActivities ?? undefined) as never,
        cards: cards as never,
        frames: frames as never,
        connections: connections as never,
        fields: fields as never,
      },
    })

    await prisma.board.delete({ where: { id: draft.id } })
    return reply.send(updated)
  })

  // Discard the draft board without saving
  app.post('/:id/discard-draft', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const tpl = await prisma.boardTemplate.findUnique({ where: { id } })
    if (!tpl) return reply.status(404).send({ error: 'Template introuvable' })
    if (tpl.ownerId !== userId) return reply.status(403).send({ error: 'AccÃ¨s refusÃ©' })
    await prisma.board.deleteMany({ where: { ownerId: userId, templateDraftOf: id } })
    return reply.status(204).send()
  })
}
