import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'

// Socle pivot: Team is a cross-module resource owned by the user, referenced by
// Daily, Wheel, Capacity, and Scrum. This is the canonical CRUD endpoint.

const TEAM_INCLUDE = {
  members: { orderBy: { order: 'asc' as const } },
  _count: { select: { dailySessions: true, wheelDraws: true, scrumRooms: true, capacityEvents: true } },
}

interface MemberInput {
  name: string
  role?: string | null
  fte?: number | null
  order?: number
}

export const teamRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.team.findMany({
      where: { ownerId },
      include: TEAM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    })
  })

  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { name, color, description, members } = request.body as {
      name: string
      color?: string
      description?: string
      members?: MemberInput[] | string[]
    }
    if (!name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    const memberList = normalizeMembers(members)
    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        ownerId,
        color: color ?? '#6366f1',
        description: description?.trim() || null,
        members: { create: memberList.map((m, i) => ({ name: m.name, role: m.role ?? null, fte: m.fte ?? null, order: m.order ?? i })) },
      },
      include: TEAM_INCLUDE,
    })
    return reply.status(201).send(team)
  })

  app.put('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const { name, color, description, members } = request.body as {
      name?: string
      color?: string
      description?: string
      members?: MemberInput[] | string[]
    }
    const existing = await prisma.team.findFirst({ where: { id, ownerId } })
    if (!existing) return reply.status(404).send({ error: 'Équipe introuvable' })
    await prisma.teamMember.deleteMany({ where: { teamId: id } })
    const memberList = normalizeMembers(members)
    const updated = await prisma.team.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        color: color ?? existing.color,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
        members: { create: memberList.map((m, i) => ({ name: m.name, role: m.role ?? null, fte: m.fte ?? null, order: m.order ?? i })) },
      },
      include: TEAM_INCLUDE,
    })
    return updated
  })

  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const existing = await prisma.team.findFirst({ where: { id, ownerId } })
    if (!existing) return reply.status(404).send({ error: 'Équipe introuvable' })
    await prisma.team.delete({ where: { id } })
    return reply.status(204).send()
  })
}

// Accept both string[] (Daily legacy: just names) and MemberInput[].
function normalizeMembers(members: MemberInput[] | string[] | undefined): MemberInput[] {
  if (!members) return []
  return (members as Array<string | MemberInput>).map((m) =>
    typeof m === 'string' ? { name: m.trim() } : { ...m, name: m.name.trim() }
  )
}
