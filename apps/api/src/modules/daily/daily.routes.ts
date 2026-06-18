import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares } from '../../lib/module-share.js'

export const dailyRoutes: FastifyPluginAsync = async (app) => {
  // ── Sessions ──────────────────────────────────────────────────────────────────

  // Sessions possédées + partagées avec l'utilisateur (avec son rôle).
  app.get('/sessions', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('daily', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const sessions = await prisma.dailySession.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      include: { participants: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return sessions.map((s) => ({ ...s, role: s.ownerId === userId ? 'OWNER' : (sharedRole.get(s.id) ?? 'VIEWER') }))
  })

  app.post('/sessions', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const { name, timePerPerson, participants, teamId } = request.body as {
      name: string
      timePerPerson?: number
      participants: string[]
      teamId?: string
    }
    if (!name?.trim()) return reply.status(400).send({ error: 'Name required' })
    if (!participants?.length) return reply.status(400).send({ error: 'At least one participant required' })
    const session = await prisma.dailySession.create({
      data: {
        name: name.trim(),
        ownerId,
        teamId: teamId ?? null,
        timePerPerson: timePerPerson ?? 120,
        participants: { create: participants.map((p, i) => ({ name: p.trim(), order: i })) },
      },
      include: { participants: { orderBy: { order: 'asc' } } },
    })
    return reply.status(201).send(session)
  })

  // Propriétaire ou utilisateur ayant un partage (sinon 404).
  app.get('/sessions/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    const session = await prisma.dailySession.findUnique({
      where: { id },
      include: { participants: { orderBy: { order: 'asc' } } },
    })
    if (!session) return reply.status(404).send({ error: 'Session not found' })
    const role = await resolveRole('daily', id, userId, session.ownerId)
    if (!role) return reply.status(404).send({ error: 'Session not found' })
    return { ...session, role }
  })

  // Stats sur les sessions terminées de l'utilisateur (30 dernières).
  app.get('/stats', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const sessions = await prisma.dailySession.findMany({
      where: { ownerId: userId, status: 'DONE', startedAt: { not: null }, endedAt: { not: null } },
      include: { participants: { select: { name: true, speakingAt: true, doneSpeaking: true } } },
      orderBy: { startedAt: 'asc' },
      take: 30,
    })

    const sessionStats = sessions.map((s) => ({
      name: s.name,
      date: s.startedAt!.toISOString(),
      durationSec: Math.round((s.endedAt!.getTime() - s.startedAt!.getTime()) / 1000),
    }))

    const speakerMap = new Map<string, { totalSec: number; sessionCount: number }>()
    for (const s of sessions) {
      const seen = new Set<string>()
      for (const p of s.participants) {
        const entry = speakerMap.get(p.name) ?? { totalSec: 0, sessionCount: 0 }
        if (!seen.has(p.name)) { seen.add(p.name); entry.sessionCount++ }
        if (p.speakingAt && p.doneSpeaking) {
          entry.totalSec += Math.max(0, Math.round((p.doneSpeaking.getTime() - p.speakingAt.getTime()) / 1000))
        }
        speakerMap.set(p.name, entry)
      }
    }

    const speakers = [...speakerMap.entries()]
      .map(([name, { totalSec, sessionCount }]) => ({ name, totalSec, sessionCount }))
      .sort((a, b) => b.sessionCount - a.sessionCount || b.totalSec - a.totalSec)
      .slice(0, 10)

    return { sessions: sessionStats, speakers, totalSessions: sessions.length }
  })

  // Propriétaire uniquement ; nettoie les partages associés.
  app.delete('/sessions/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const session = await prisma.dailySession.findFirst({ where: { id, ownerId } })
    if (!session) return reply.status(404).send({ error: 'Session not found' })
    await prisma.dailySession.delete({ where: { id } })
    await deleteResourceShares('daily', id)
    return reply.status(204).send()
  })
}
