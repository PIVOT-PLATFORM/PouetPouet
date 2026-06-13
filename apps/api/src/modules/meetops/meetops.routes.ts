import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { expandRecurrence, type RecurrenceRule, type RecurrenceFreq } from '@pouetpouet/shared'
import { buildIcsCalendar, icsFilename, type IcsMeeting } from './ics.js'

// MeetOps — socle CRUD. Hiérarchie possédée par l'utilisateur propriétaire :
// MeetEvent → MeetSeries → Meeting → MeetingParticipant.
// L'envoi (.ics/SMTP/Graph), les listes de diffusion, l'historique et les
// templates relèvent des itérations suivantes (cf. docs/specs/meetops.md).

type MeetEventType = 'VERSION' | 'SPRINT' | 'COPIL' | 'COMOP' | 'RELEASE' | 'ONBOARDING' | 'CUSTOM'
type MeetingStatus = 'DRAFT' | 'SENT' | 'UPDATED' | 'CANCELLED'

// Graphe complet renvoyé sur l'écran de détail d'un événement.
const EVENT_INCLUDE = {
  series: {
    orderBy: { order: 'asc' as const },
    include: {
      meetings: {
        orderBy: { startAt: 'asc' as const },
        include: { participants: true },
      },
    },
  },
}

interface ParticipantInput {
  email: string
  name?: string | null
  role?: string | null
}

export const meetopsRoutes: FastifyPluginAsync = async (app) => {
  // Résout une série uniquement si son événement appartient à l'appelant.
  async function ownedSeries(seriesId: string, ownerId: string) {
    const series = await prisma.meetSeries.findUnique({
      where: { id: seriesId },
      include: { event: { select: { ownerId: true } } },
    })
    if (!series || series.event.ownerId !== ownerId) return null
    return series
  }

  // Résout une réunion uniquement si elle remonte jusqu'à un événement de l'appelant.
  async function ownedMeeting(meetingId: string, ownerId: string) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { series: { include: { event: { select: { ownerId: true } } } } },
    })
    if (!meeting || meeting.series.event.ownerId !== ownerId) return null
    return meeting
  }

  // ── Événements ────────────────────────────────────────────────────────────────

  app.get('/events', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.meetEvent.findMany({
      where: { ownerId },
      include: { _count: { select: { series: true } } },
      orderBy: { updatedAt: 'desc' },
    })
  })

  app.get('/events/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const event = await prisma.meetEvent.findFirst({
      where: { id, ownerId },
      include: EVENT_INCLUDE,
    })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    return event
  })

  app.post('/events', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as {
      name: string
      description?: string | null
      type?: MeetEventType
      startDate?: string | null
      endDate?: string | null
      color?: string
      tags?: string[]
    }
    if (!body.name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    if (body.startDate && body.endDate && new Date(body.endDate) < new Date(body.startDate)) {
      return reply.status(400).send({ error: 'La date de fin doit suivre la date de début' })
    }
    const event = await prisma.meetEvent.create({
      data: {
        ownerId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        type: body.type ?? 'CUSTOM',
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        color: body.color ?? '#475569',
        tags: body.tags ?? [],
      },
      include: EVENT_INCLUDE,
    })
    return reply.status(201).send(event)
  })

  app.patch('/events/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as {
      name?: string
      description?: string | null
      type?: MeetEventType
      status?: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'ARCHIVED'
      startDate?: string | null
      endDate?: string | null
      color?: string
      tags?: string[]
    }
    const event = await prisma.meetEvent.findFirst({ where: { id, ownerId } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const updated = await prisma.meetEvent.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.startDate !== undefined ? { startDate: body.startDate ? new Date(body.startDate) : null } : {}),
        ...(body.endDate !== undefined ? { endDate: body.endDate ? new Date(body.endDate) : null } : {}),
        ...(body.color !== undefined ? { color: body.color } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
      },
      include: EVENT_INCLUDE,
    })
    return updated
  })

  app.delete('/events/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const event = await prisma.meetEvent.findFirst({ where: { id, ownerId } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    await prisma.meetEvent.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── Séries ──────────────────────────────────────────────────────────────────

  app.post('/events/:eventId/series', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as {
      title: string
      recurrence?: unknown
      defaultDurationMin?: number
      defaultAgenda?: string | null
    }
    if (!body.title?.trim()) return reply.status(400).send({ error: 'Titre requis' })
    const event = await prisma.meetEvent.findFirst({ where: { id: eventId, ownerId } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const count = await prisma.meetSeries.count({ where: { eventId } })
    const series = await prisma.meetSeries.create({
      data: {
        eventId,
        title: body.title.trim(),
        recurrence: body.recurrence === undefined ? undefined : (body.recurrence as object),
        defaultDurationMin: body.defaultDurationMin ?? 60,
        defaultAgenda: body.defaultAgenda?.trim() || null,
        order: count,
      },
      include: { meetings: { include: { participants: true } } },
    })
    return reply.status(201).send(series)
  })

  app.patch('/series/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as {
      title?: string
      recurrence?: unknown
      defaultDurationMin?: number
      defaultAgenda?: string | null
    }
    if (!(await ownedSeries(id, ownerId))) return reply.status(404).send({ error: 'Série introuvable' })
    const updated = await prisma.meetSeries.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.recurrence !== undefined ? { recurrence: body.recurrence as object } : {}),
        ...(body.defaultDurationMin !== undefined ? { defaultDurationMin: body.defaultDurationMin } : {}),
        ...(body.defaultAgenda !== undefined ? { defaultAgenda: body.defaultAgenda?.trim() || null } : {}),
      },
      include: { meetings: { orderBy: { startAt: 'asc' }, include: { participants: true } } },
    })
    return updated
  })

  app.delete('/series/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    if (!(await ownedSeries(id, ownerId))) return reply.status(404).send({ error: 'Série introuvable' })
    await prisma.meetSeries.delete({ where: { id } })
    return reply.status(204).send()
  })

  // Génère les réunions d'une série depuis une règle de récurrence.
  // La règle est mémorisée sur la série ; seules les occurrences absentes
  // (dédupliquées par horaire de début) sont créées — régénérer est idempotent.
  app.post('/series/:seriesId/generate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { seriesId } = request.params as { seriesId: string }
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as {
      freq: RecurrenceFreq
      interval?: number
      startDate: string
      daysOfWeek?: number[]
      until?: string | null
      count?: number | null
      durationMin?: number
      location?: string | null
    }
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(body.freq)) {
      return reply.status(400).send({ error: 'Fréquence invalide' })
    }
    if (!body.startDate || Number.isNaN(new Date(body.startDate).getTime())) {
      return reply.status(400).send({ error: 'Date de début invalide' })
    }
    if (!body.until && !body.count) {
      return reply.status(400).send({ error: 'Une fin est requise (date ou nombre d\'occurrences)' })
    }
    const series = await ownedSeries(seriesId, ownerId)
    if (!series) return reply.status(404).send({ error: 'Série introuvable' })

    const rule: RecurrenceRule = {
      freq: body.freq,
      interval: body.interval ?? 1,
      startDate: body.startDate,
      daysOfWeek: body.daysOfWeek,
      until: body.until ?? undefined,
      count: body.count ?? undefined,
    }
    const occurrences = expandRecurrence(rule)

    // Déduplication contre les réunions déjà présentes (même instant de début).
    const existing = await prisma.meeting.findMany({ where: { seriesId }, select: { startAt: true } })
    const existingMs = new Set(existing.map((m) => m.startAt.getTime()))
    const toCreate = occurrences.filter((d) => !existingMs.has(d.getTime()))

    await prisma.$transaction([
      prisma.meetSeries.update({ where: { id: seriesId }, data: { recurrence: rule as object } }),
      ...toCreate.map((d) =>
        prisma.meeting.create({
          data: {
            seriesId,
            title: series.title,
            startAt: d,
            durationMin: body.durationMin ?? series.defaultDurationMin,
            agenda: series.defaultAgenda,
            location: body.location?.trim() || null,
          },
        }),
      ),
    ])

    const updated = await prisma.meetSeries.findUnique({
      where: { id: seriesId },
      include: { meetings: { orderBy: { startAt: 'asc' }, include: { participants: true } } },
    })
    return reply.status(201).send({ created: toCreate.length, skipped: occurrences.length - toCreate.length, series: updated })
  })

  // ── Réunions ──────────────────────────────────────────────────────────────────

  app.post('/series/:seriesId/meetings', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { seriesId } = request.params as { seriesId: string }
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as {
      title?: string
      startAt: string
      durationMin?: number
      location?: string | null
      agenda?: string | null
      participants?: ParticipantInput[]
    }
    if (!body.startAt) return reply.status(400).send({ error: 'Date de début requise' })
    const series = await ownedSeries(seriesId, ownerId)
    if (!series) return reply.status(404).send({ error: 'Série introuvable' })
    const meeting = await prisma.meeting.create({
      data: {
        seriesId,
        title: body.title?.trim() || series.title,
        startAt: new Date(body.startAt),
        durationMin: body.durationMin ?? series.defaultDurationMin,
        location: body.location?.trim() || null,
        agenda: body.agenda?.trim() || series.defaultAgenda,
        participants: {
          create: (body.participants ?? [])
            .filter((p) => p.email?.trim())
            .map((p) => ({ email: p.email.trim(), name: p.name?.trim() || null, role: p.role?.trim() || null })),
        },
      },
      include: { participants: true },
    })
    return reply.status(201).send(meeting)
  })

  app.patch('/meetings/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as {
      title?: string
      startAt?: string
      durationMin?: number
      location?: string | null
      agenda?: string | null
      status?: MeetingStatus
    }
    if (!(await ownedMeeting(id, ownerId))) return reply.status(404).send({ error: 'Réunion introuvable' })
    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.startAt !== undefined ? { startAt: new Date(body.startAt) } : {}),
        ...(body.durationMin !== undefined ? { durationMin: body.durationMin } : {}),
        ...(body.location !== undefined ? { location: body.location?.trim() || null } : {}),
        ...(body.agenda !== undefined ? { agenda: body.agenda?.trim() || null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: { participants: true },
    })
    return updated
  })

  app.delete('/meetings/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    if (!(await ownedMeeting(id, ownerId))) return reply.status(404).send({ error: 'Réunion introuvable' })
    await prisma.meeting.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── Participants ──────────────────────────────────────────────────────────────

  app.post('/meetings/:meetingId/participants', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { meetingId } = request.params as { meetingId: string }
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as ParticipantInput
    if (!body.email?.trim()) return reply.status(400).send({ error: 'Email requis' })
    if (!(await ownedMeeting(meetingId, ownerId))) return reply.status(404).send({ error: 'Réunion introuvable' })
    const participant = await prisma.meetingParticipant.create({
      data: {
        meetingId,
        email: body.email.trim(),
        name: body.name?.trim() || null,
        role: body.role?.trim() || null,
      },
    })
    return reply.status(201).send(participant)
  })

  app.delete('/participants/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const participant = await prisma.meetingParticipant.findUnique({
      where: { id },
      include: { meeting: { include: { series: { include: { event: { select: { ownerId: true } } } } } } },
    })
    if (!participant || participant.meeting.series.event.ownerId !== ownerId) {
      return reply.status(404).send({ error: 'Participant introuvable' })
    }
    await prisma.meetingParticipant.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── Export .ics ─────────────────────────────────────────────────────────────

  type MeetingRow = {
    id: string; title: string; startAt: Date; durationMin: number
    location: string | null; agenda: string | null; status: string
    participants: { email: string; name: string | null; role: string | null }[]
  }
  const toIcs = (m: MeetingRow): IcsMeeting => ({
    id: m.id,
    title: m.title,
    startAt: m.startAt,
    durationMin: m.durationMin,
    location: m.location,
    agenda: m.agenda,
    cancelled: m.status === 'CANCELLED',
    participants: m.participants,
  })
  const sendIcs = (reply: FastifyReply, ics: string, filename: string) =>
    reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(ics)
  const MEETING_SELECT = {
    id: true, title: true, startAt: true, durationMin: true, location: true, agenda: true, status: true,
    participants: { select: { email: true, name: true, role: true } },
  } as const

  app.get('/meetings/:id/ics', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: { ...MEETING_SELECT, series: { select: { event: { select: { ownerId: true, owner: { select: { email: true, name: true } } } } } } },
    })
    if (!meeting || meeting.series.event.ownerId !== ownerId) return reply.status(404).send({ error: 'Réunion introuvable' })
    const owner = meeting.series.event.owner
    const ics = buildIcsCalendar([toIcs(meeting)], { calendarName: meeting.title, organizerEmail: owner.email, organizerName: owner.name })
    return sendIcs(reply, ics, icsFilename(meeting.title))
  })

  app.get('/series/:id/ics', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const series = await prisma.meetSeries.findUnique({
      where: { id },
      select: {
        title: true,
        meetings: { orderBy: { startAt: 'asc' }, select: MEETING_SELECT },
        event: { select: { ownerId: true, owner: { select: { email: true, name: true } } } },
      },
    })
    if (!series || series.event.ownerId !== ownerId) return reply.status(404).send({ error: 'Série introuvable' })
    const owner = series.event.owner
    const ics = buildIcsCalendar(series.meetings.map(toIcs), { calendarName: series.title, organizerEmail: owner.email, organizerName: owner.name })
    return sendIcs(reply, ics, icsFilename(series.title))
  })

  app.get('/events/:id/ics', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const event = await prisma.meetEvent.findFirst({
      where: { id, ownerId },
      select: {
        name: true,
        owner: { select: { email: true, name: true } },
        series: { select: { meetings: { orderBy: { startAt: 'asc' }, select: MEETING_SELECT } } },
      },
    })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const meetings = event.series.flatMap((s) => s.meetings).sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    const ics = buildIcsCalendar(meetings.map(toIcs), { calendarName: event.name, organizerEmail: event.owner.email, organizerName: event.owner.name })
    return sendIcs(reply, ics, icsFilename(event.name))
  })
}
