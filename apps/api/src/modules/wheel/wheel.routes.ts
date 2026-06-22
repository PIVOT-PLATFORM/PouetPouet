import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { bus } from '../../lib/bus.js'
import { resolveRole, sharedResourceIds, deleteResourceShares } from '../../lib/module-share.js'

// Weighted pick without replacement.
// Members drawn recently get a lower weight so they're less likely to be picked again.
// The decay formula (1 / drawIndex+1) means the most recent draw weighs 1x, the one
// before 0.5x, the one before that 0.33x, etc. â€” ensuring diversity without
// eliminating anyone from the pool.
function pickWeighted(pool: string[], recentScores: Record<string, number>, count: number): string[] {
  const arr = [...pool]
  const results: string[] = []

  for (let i = 0; i < count && arr.length > 0; i++) {
    // weight = 1 / (recent_score + 1) so undrawn members have weight 1, heavily
    // drawn members approach 0 but never reach it
    const weights = arr.map((name) => 1 / ((recentScores[name] ?? 0) + 1))
    const total = weights.reduce((s, w) => s + w, 0)

    let r = Math.random() * total
    let picked = arr[arr.length - 1]
    for (let k = 0; k < arr.length; k++) {
      r -= weights[k]
      if (r <= 0) { picked = arr[k]; break }
    }

    results.push(picked)
    arr.splice(arr.indexOf(picked), 1)
  }

  return results
}

export const wheelRoutes: FastifyPluginAsync = async (app) => {
  // â”€â”€ Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.get('/events', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('wheel', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const events = await prisma.wheelEvent.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      include: { draws: { orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    })
    return events.map((e) => ({ ...e, role: e.ownerId === userId ? 'OWNER' : (sharedRole.get(e.id) ?? 'VIEWER') }))
  })

  app.post('/events', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { name } = request.body as { name: string }
    if (!name?.trim()) return reply.status(400).send({ error: 'Name required' })
    const event = await prisma.wheelEvent.create({
      data: { name: name.trim(), ownerId },
      include: { draws: true },
    })
    return reply.status(201).send(event)
  })

  app.patch('/events/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    const { name } = request.body as { name: string }
    const event = await prisma.wheelEvent.findUnique({ where: { id } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    const role = await resolveRole('wheel', id, userId, event.ownerId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(404).send({ error: 'Event not found' })
    const updated = await prisma.wheelEvent.update({
      where: { id },
      data: { name: name.trim() },
      include: { draws: { orderBy: { createdAt: 'desc' } } },
    })
    return updated
  })

  app.delete('/events/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const event = await prisma.wheelEvent.findFirst({ where: { id, ownerId } })
    if (!event) return reply.status(404).send({ error: 'Event not found' })
    await prisma.wheelEvent.delete({ where: { id } })
    await deleteResourceShares('wheel', id)
    return reply.status(204).send()
  })

  // â”€â”€ Draws â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  app.get('/draws', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.wheelDraw.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  })

  app.post('/draws', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { teamId, count, excluded, eventId, note, mode } = request.body as {
      teamId: string
      count: number
      excluded?: string[]
      eventId?: string
      note?: string
      mode?: 'WEIGHTED' | 'RANDOM'
    }

    if (!teamId) return reply.status(400).send({ error: 'teamId required' })
    if (!count || count < 1) return reply.status(400).send({ error: 'count must be >= 1' })

    const team = await prisma.team.findFirst({
      where: { id: teamId, ownerId },
      include: { members: true },
    })
    if (!team) return reply.status(404).send({ error: 'Team not found' })

    const excludedNames = excluded ?? []
    const available = team.members.map((m) => m.name).filter((n) => !excludedNames.includes(n))
    if (available.length === 0) return reply.status(400).send({ error: 'No members available after exclusions' })

    const drawMode = mode === 'RANDOM' ? 'RANDOM' : 'WEIGHTED'

    let results: string[]
    if (drawMode === 'WEIGHTED') {
      const lookback = team.members.length * 3
      const recentDraws = await prisma.wheelDraw.findMany({
        where: { ownerId, teamId },
        orderBy: { createdAt: 'desc' },
        take: lookback,
        select: { results: true },
      })
      const recentScores: Record<string, number> = {}
      recentDraws.forEach((draw, drawIndex) => {
        const decay = 1 / (drawIndex + 1)
        draw.results.forEach((name) => {
          recentScores[name] = (recentScores[name] ?? 0) + decay
        })
      })
      results = pickWeighted(available, recentScores, Math.min(count, available.length))
    } else {
      results = pickWeighted(available, {}, Math.min(count, available.length))
    }

    // Update event timestamp if provided
    if (eventId) {
      await prisma.wheelEvent.updateMany({ where: { id: eventId, ownerId }, data: { updatedAt: new Date() } })
    }

    const draw = await prisma.wheelDraw.create({
      data: {
        ownerId,
        teamId,
        teamName: team.name,
        eventId: eventId ?? null,
        note: note?.trim() ?? null,
        count,
        mode: drawMode,
        results,
        excluded: excludedNames,
      },
    })

    bus.publish({
      type: 'wheel.draw.completed',
      module: 'wheel',
      actorId: ownerId,
      payload: { drawId: draw.id, teamId, teamName: team.name, results, count, mode: drawMode },
    })

    return reply.status(201).send(draw)
  })

  app.patch('/draws/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const { note, eventId } = request.body as { note?: string; eventId?: string | null }

    const draw = await prisma.wheelDraw.findFirst({ where: { id, ownerId } })
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })

    const updated = await prisma.wheelDraw.update({
      where: { id },
      data: {
        ...(note !== undefined ? { note: note?.trim() || null } : {}),
        ...(eventId !== undefined ? { eventId: eventId ?? null } : {}),
      },
    })

    // Refresh event timestamp
    if (eventId) {
      await prisma.wheelEvent.updateMany({ where: { id: eventId, ownerId }, data: { updatedAt: new Date() } })
    }

    return updated
  })

  app.delete('/draws/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const draw = await prisma.wheelDraw.findFirst({ where: { id, ownerId } })
    if (!draw) return reply.status(404).send({ error: 'Draw not found' })
    await prisma.wheelDraw.delete({ where: { id } })
    return reply.status(204).send()
  })
}
