import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'

// Full graph returned for the event detail screen.
const EVENT_INCLUDE = {
  team: { select: { id: true, name: true, color: true } },
  parent: { select: { id: true, name: true, type: true } },
  children: { select: { id: true, name: true, type: true, status: true }, orderBy: { startDate: 'asc' as const } },
  members: {
    orderBy: { order: 'asc' as const },
    include: { absences: { orderBy: { startDate: 'asc' as const } } },
  },
}

const TEAM_INCLUDE = {
  members: { orderBy: { order: 'asc' as const } },
  _count: { select: { events: true } },
}

interface MemberInput {
  name: string
  role?: string | null
  fte?: number
  focusFactor?: number | null
  order?: number
}

export const capacityRoutes: FastifyPluginAsync = async (app) => {
  // Resolve the authenticated event member only if it belongs to the caller.
  async function ownedMember(memberId: string, ownerId: string) {
    const member = await prisma.capacityEventMember.findUnique({
      where: { id: memberId },
      include: { event: { select: { ownerId: true } } },
    })
    if (!member || member.event.ownerId !== ownerId) return null
    return member
  }

  // ── Teams ─────────────────────────────────────────────────────────────────────

  app.get('/teams', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.capacityTeam.findMany({
      where: { ownerId },
      include: TEAM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    })
  })

  app.post('/teams', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { name, color, description, members } = request.body as {
      name: string
      color?: string
      description?: string
      members?: MemberInput[]
    }
    if (!name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    const team = await prisma.capacityTeam.create({
      data: {
        name: name.trim(),
        ownerId,
        color: color ?? '#6366f1',
        description: description?.trim() || null,
        members: {
          create: (members ?? []).map((m, i) => ({
            name: m.name.trim(),
            role: m.role?.trim() || null,
            fte: m.fte ?? 1,
            order: m.order ?? i,
          })),
        },
      },
      include: TEAM_INCLUDE,
    })
    return reply.status(201).send(team)
  })

  app.put('/teams/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const { name, color, description, members } = request.body as {
      name: string
      color?: string
      description?: string
      members?: MemberInput[]
    }
    const team = await prisma.capacityTeam.findFirst({ where: { id, ownerId } })
    if (!team) return reply.status(404).send({ error: 'Équipe introuvable' })
    await prisma.capacityTeamMember.deleteMany({ where: { teamId: id } })
    const updated = await prisma.capacityTeam.update({
      where: { id },
      data: {
        name: name?.trim() || team.name,
        color: color ?? team.color,
        description: description !== undefined ? (description?.trim() || null) : team.description,
        members: {
          create: (members ?? []).map((m, i) => ({
            name: m.name.trim(),
            role: m.role?.trim() || null,
            fte: m.fte ?? 1,
            order: m.order ?? i,
          })),
        },
      },
      include: TEAM_INCLUDE,
    })
    return updated
  })

  app.delete('/teams/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const team = await prisma.capacityTeam.findFirst({ where: { id, ownerId } })
    if (!team) return reply.status(404).send({ error: 'Équipe introuvable' })
    await prisma.capacityTeam.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── Events ──────────────────────────────────────────────────────────────────

  app.get('/events', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.capacityEvent.findMany({
      where: { ownerId },
      include: {
        team: { select: { id: true, name: true, color: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { members: true, children: true } },
      },
      orderBy: { startDate: 'desc' },
    })
  })

  app.post('/events', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as {
      name: string
      type?: 'PI_PLANNING' | 'SPRINT' | 'RELEASE' | 'CUSTOM'
      teamId?: string | null
      parentId?: string | null
      startDate: string
      endDate: string
      workingDays?: number[]
      hoursPerDay?: number
      focusFactor?: number
      pointsPerPersonDay?: number | null
      seedFromTeam?: boolean
      members?: MemberInput[]
    }
    if (!body.name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    if (!body.startDate || !body.endDate) return reply.status(400).send({ error: 'Dates requises' })
    if (new Date(body.endDate) < new Date(body.startDate)) {
      return reply.status(400).send({ error: 'La date de fin doit suivre la date de début' })
    }

    // Validate optional team / parent ownership.
    if (body.teamId) {
      const team = await prisma.capacityTeam.findFirst({ where: { id: body.teamId, ownerId } })
      if (!team) return reply.status(400).send({ error: 'Équipe invalide' })
    }
    if (body.parentId) {
      const parent = await prisma.capacityEvent.findFirst({ where: { id: body.parentId, ownerId } })
      if (!parent) return reply.status(400).send({ error: 'Événement parent invalide' })
    }

    // Seed members either from the explicit list or from the linked team roster.
    let seeded: MemberInput[] = body.members ?? []
    if ((!seeded || seeded.length === 0) && body.seedFromTeam && body.teamId) {
      const roster = await prisma.capacityTeamMember.findMany({
        where: { teamId: body.teamId },
        orderBy: { order: 'asc' },
      })
      seeded = roster.map((m, i) => ({ name: m.name, role: m.role, fte: m.fte, order: i }))
    }

    const event = await prisma.capacityEvent.create({
      data: {
        name: body.name.trim(),
        ownerId,
        type: body.type ?? 'SPRINT',
        teamId: body.teamId ?? null,
        parentId: body.parentId ?? null,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        workingDays: body.workingDays && body.workingDays.length > 0 ? body.workingDays : [1, 2, 3, 4, 5],
        hoursPerDay: body.hoursPerDay ?? 8,
        focusFactor: body.focusFactor ?? 0.8,
        pointsPerPersonDay: body.pointsPerPersonDay ?? null,
        members: {
          create: seeded.map((m, i) => ({
            name: m.name.trim(),
            role: m.role?.trim() || null,
            fte: m.fte ?? 1,
            focusFactor: m.focusFactor ?? null,
            order: m.order ?? i,
          })),
        },
      },
      include: EVENT_INCLUDE,
    })
    return reply.status(201).send(event)
  })

  app.get('/events/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const event = await prisma.capacityEvent.findFirst({
      where: { id, ownerId },
      include: EVENT_INCLUDE,
    })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    return event
  })

  app.put('/events/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const existing = await prisma.capacityEvent.findFirst({ where: { id, ownerId } })
    if (!existing) return reply.status(404).send({ error: 'Événement introuvable' })

    const body = request.body as Partial<{
      name: string
      type: 'PI_PLANNING' | 'SPRINT' | 'RELEASE' | 'CUSTOM'
      status: 'PLANNING' | 'ACTIVE' | 'DONE'
      teamId: string | null
      parentId: string | null
      startDate: string
      endDate: string
      workingDays: number[]
      hoursPerDay: number
      focusFactor: number
      pointsPerPersonDay: number | null
      committedPoints: number | null
      completedPoints: number | null
      notes: string | null
    }>

    if (body.parentId === id) return reply.status(400).send({ error: 'Un événement ne peut pas être son propre parent' })

    const updated = await prisma.capacityEvent.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? undefined,
        type: body.type ?? undefined,
        status: body.status ?? undefined,
        teamId: body.teamId !== undefined ? body.teamId : undefined,
        parentId: body.parentId !== undefined ? body.parentId : undefined,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        workingDays: body.workingDays ?? undefined,
        hoursPerDay: body.hoursPerDay ?? undefined,
        focusFactor: body.focusFactor ?? undefined,
        pointsPerPersonDay: body.pointsPerPersonDay !== undefined ? body.pointsPerPersonDay : undefined,
        committedPoints: body.committedPoints !== undefined ? body.committedPoints : undefined,
        completedPoints: body.completedPoints !== undefined ? body.completedPoints : undefined,
        notes: body.notes !== undefined ? (body.notes?.trim() || null) : undefined,
      },
      include: EVENT_INCLUDE,
    })
    return updated
  })

  app.delete('/events/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const event = await prisma.capacityEvent.findFirst({ where: { id, ownerId } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    await prisma.capacityEvent.delete({ where: { id } })
    return reply.status(204).send()
  })

  // Past finished events of the same team — basis for the realization feedback.
  app.get('/events/:id/history', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const event = await prisma.capacityEvent.findFirst({ where: { id, ownerId } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })

    return prisma.capacityEvent.findMany({
      where: {
        ownerId,
        id: { not: id },
        teamId: event.teamId ?? undefined,
        OR: [{ status: 'DONE' }, { completedPoints: { not: null } }],
      },
      include: {
        members: { include: { absences: true } },
      },
      orderBy: { endDate: 'desc' },
      take: 12,
    })
  })

  // ── Event members ─────────────────────────────────────────────────────────────

  app.post('/events/:id/members', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const event = await prisma.capacityEvent.findFirst({ where: { id, ownerId }, include: { members: true } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const body = request.body as MemberInput
    if (!body.name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    const member = await prisma.capacityEventMember.create({
      data: {
        eventId: id,
        name: body.name.trim(),
        role: body.role?.trim() || null,
        fte: body.fte ?? 1,
        focusFactor: body.focusFactor ?? null,
        order: body.order ?? event.members.length,
      },
      include: { absences: true },
    })
    return reply.status(201).send(member)
  })

  app.put('/members/:memberId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { memberId } = request.params as { memberId: string }
    const { id: ownerId } = request.user as { id: string }
    if (!(await ownedMember(memberId, ownerId))) return reply.status(404).send({ error: 'Membre introuvable' })
    const body = request.body as Partial<MemberInput>
    const member = await prisma.capacityEventMember.update({
      where: { id: memberId },
      data: {
        name: body.name?.trim() ?? undefined,
        role: body.role !== undefined ? (body.role?.trim() || null) : undefined,
        fte: body.fte ?? undefined,
        focusFactor: body.focusFactor !== undefined ? body.focusFactor : undefined,
        order: body.order ?? undefined,
      },
      include: { absences: { orderBy: { startDate: 'asc' } } },
    })
    return member
  })

  app.delete('/members/:memberId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { memberId } = request.params as { memberId: string }
    const { id: ownerId } = request.user as { id: string }
    if (!(await ownedMember(memberId, ownerId))) return reply.status(404).send({ error: 'Membre introuvable' })
    await prisma.capacityEventMember.delete({ where: { id: memberId } })
    return reply.status(204).send()
  })

  // ── Absences ──────────────────────────────────────────────────────────────────

  app.post('/members/:memberId/absences', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { memberId } = request.params as { memberId: string }
    const { id: ownerId } = request.user as { id: string }
    if (!(await ownedMember(memberId, ownerId))) return reply.status(404).send({ error: 'Membre introuvable' })
    const body = request.body as { startDate: string; endDate: string; fraction?: number; reason?: string }
    if (!body.startDate || !body.endDate) return reply.status(400).send({ error: 'Dates requises' })
    if (new Date(body.endDate) < new Date(body.startDate)) {
      return reply.status(400).send({ error: 'La date de fin doit suivre la date de début' })
    }
    const absence = await prisma.capacityAbsence.create({
      data: {
        eventMemberId: memberId,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        fraction: body.fraction ?? 1,
        reason: body.reason?.trim() || null,
      },
    })
    return reply.status(201).send(absence)
  })

  app.delete('/absences/:absenceId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { absenceId } = request.params as { absenceId: string }
    const { id: ownerId } = request.user as { id: string }
    const absence = await prisma.capacityAbsence.findUnique({
      where: { id: absenceId },
      include: { member: { include: { event: { select: { ownerId: true } } } } },
    })
    if (!absence || absence.member.event.ownerId !== ownerId) {
      return reply.status(404).send({ error: 'Absence introuvable' })
    }
    await prisma.capacityAbsence.delete({ where: { id: absenceId } })
    return reply.status(204).send()
  })
}
