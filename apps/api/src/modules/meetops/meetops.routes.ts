import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { prisma } from '../../lib/prisma.js'
import { resolveRole, sharedResourceIds, deleteResourceShares } from '../../lib/module-share.js'
import { buildIcsCalendar, icsFilename, type IcsMeeting } from './ics.js'
import {
  isGraphConfigured, buildAuthUrl, exchangeCodeForTokens, refreshTokens, fetchMe,
  createTeamsEvent, updateTeamsEvent, cancelEvent, type TokenSet, type GraphMeetingInput,
} from './graph.js'
import { encryptSecret, decryptSecret } from '../../lib/crypto.js'

// MeetOps — socle CRUD. Hiérarchie possédée par l'utilisateur propriétaire :
// MeetEvent → Meeting → MeetingParticipant (liste de réunions à plat).
// L'envoi (.ics/SMTP/Graph), les listes de diffusion, l'historique et les
// templates relèvent des itérations suivantes (cf. docs/specs/meetops.md).

type MeetEventType = 'VERSION' | 'SPRINT' | 'COPIL' | 'COMOP' | 'RELEASE' | 'ONBOARDING' | 'CUSTOM'
type MeetingStatus = 'DRAFT' | 'SENT' | 'UPDATED' | 'CANCELLED'

// Graphe complet renvoyé sur l'écran de détail d'un événement.
const EVENT_INCLUDE = {
  meetings: {
    orderBy: [{ order: 'asc' as const }, { startAt: 'asc' as const }],
    include: { participants: true },
  },
}

interface ParticipantInput {
  email: string
  name?: string | null
  role?: string | null
}

export const meetopsRoutes: FastifyPluginAsync = async (app) => {
  // Résout une réunion si l'appelant est propriétaire ou éditeur de l'événement parent.
  async function ownedMeeting(meetingId: string, userId: string) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { event: { select: { id: true, ownerId: true } } },
    })
    if (!meeting) return null
    const role = await resolveRole('meetops', meeting.event.id, userId, meeting.event.ownerId)
    if (role !== 'OWNER' && role !== 'EDITOR') return null
    return meeting
  }

  // Journal d'activité (best-effort : ne fait jamais échouer l'opération métier).
  type HistoryEntry = {
    eventId: string
    meetingId?: string | null
    meetingTitle?: string | null
    userId?: string | null
    action: string
    field?: string | null
    oldValue?: string | null
    newValue?: string | null
  }
  async function logHistory(entries: HistoryEntry | HistoryEntry[]) {
    const data = Array.isArray(entries) ? entries : [entries]
    if (data.length === 0) return
    try { await prisma.meetHistory.createMany({ data }) } catch { /* non bloquant */ }
  }

  // ── Événements ────────────────────────────────────────────────────────────────

  app.get('/events', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('meetops', userId)
    const sharedRole = new Map(shared.map((s) => [s.id, s.role]))
    const events = await prisma.meetEvent.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      include: { _count: { select: { meetings: true } } },
      orderBy: { updatedAt: 'desc' },
    })
    return events.map((e) => ({ ...e, role: e.ownerId === userId ? 'OWNER' : (sharedRole.get(e.id) ?? 'VIEWER') }))
  })

  // Recherche transverse : événements correspondant par nom/description/tag, ou
  // contenant une réunion (titre/étiquette) ou un participant (email/nom) qui matche.
  // Renvoie pour chaque événement les réunions correspondantes (pour expliquer le match).
  app.get('/search', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const { q } = request.query as { q?: string }
    const term = (q ?? '').trim()
    if (term.length < 2) return []
    const shared = await sharedResourceIds('meetops', userId)
    const ci = { contains: term, mode: 'insensitive' as const }
    const meetingMatch = {
      OR: [
        { title: ci },
        { label: ci },
        { participants: { some: { OR: [{ email: ci }, { name: ci }] } } },
      ],
    }
    const events = await prisma.meetEvent.findMany({
      where: {
        AND: [
          { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
          { OR: [
            { name: ci },
            { description: ci },
            { tags: { has: term } },
            { meetings: { some: meetingMatch } },
          ] },
        ],
      },
      select: {
        id: true, name: true, description: true, color: true, type: true, status: true,
        _count: { select: { meetings: true } },
        meetings: { where: meetingMatch, select: { id: true, title: true, label: true }, take: 6, orderBy: { startAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return events.map((e) => {
      const { meetings, ...rest } = e
      return { ...rest, matched: meetings }
    })
  })

  app.get('/events/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    const event = await prisma.meetEvent.findUnique({
      where: { id },
      include: EVENT_INCLUDE,
    })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const role = await resolveRole('meetops', id, userId, event.ownerId)
    if (!role) return reply.status(404).send({ error: 'Événement introuvable' })
    return { ...event, role }
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
    const { id: userId } = request.user as { id: string }
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
    const event = await prisma.meetEvent.findUnique({ where: { id } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const role = await resolveRole('meetops', id, userId, event.ownerId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(404).send({ error: 'Événement introuvable' })
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
    await deleteResourceShares('meetops', id)
    return reply.status(204).send()
  })

  // ── Réunions ──────────────────────────────────────────────────────────────────

  app.post('/events/:eventId/meetings', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const { id: userId } = request.user as { id: string }
    const body = request.body as {
      title?: string
      label?: string | null
      startAt: string
      durationMin?: number
      location?: string | null
      agenda?: string | null
      participants?: ParticipantInput[]
    }
    if (!body.startAt) return reply.status(400).send({ error: 'Date de début requise' })
    const event = await prisma.meetEvent.findUnique({ where: { id: eventId }, select: { id: true, ownerId: true } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const eventRole = await resolveRole('meetops', eventId, userId, event.ownerId)
    if (eventRole !== 'OWNER' && eventRole !== 'EDITOR') return reply.status(404).send({ error: 'Événement introuvable' })
    // Nouvelle réunion ajoutée en fin de liste (ordre manuel).
    const last = await prisma.meeting.findFirst({ where: { eventId }, orderBy: { order: 'desc' }, select: { order: true } })
    const meeting = await prisma.meeting.create({
      data: {
        eventId,
        title: body.title?.trim() || 'Réunion',
        label: body.label?.trim() || null,
        order: (last?.order ?? -1) + 1,
        startAt: new Date(body.startAt),
        durationMin: body.durationMin ?? 60,
        location: body.location?.trim() || null,
        agenda: body.agenda?.trim() || null,
        participants: {
          create: (body.participants ?? [])
            .filter((p) => p.email?.trim())
            .map((p) => ({ email: p.email.trim(), name: p.name?.trim() || null, role: p.role?.trim() || null })),
        },
      },
      include: { participants: true },
    })
    await logHistory({ eventId, meetingId: meeting.id, meetingTitle: meeting.title, userId, action: 'created' })
    return reply.status(201).send(meeting)
  })

  // Réordonne les réunions d'un événement : le tableau `ids` fixe le nouvel ordre.
  // Seules les réunions appartenant à l'événement de l'appelant sont prises en compte.
  app.patch('/events/:eventId/meetings/reorder', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const { id: userId } = request.user as { id: string }
    const { ids } = request.body as { ids: string[] }
    if (!Array.isArray(ids)) return reply.status(400).send({ error: 'Liste d\'identifiants requise' })
    const event = await prisma.meetEvent.findUnique({ where: { id: eventId }, select: { id: true, ownerId: true } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const eventRole = await resolveRole('meetops', eventId, userId, event.ownerId)
    if (eventRole !== 'OWNER' && eventRole !== 'EDITOR') return reply.status(404).send({ error: 'Événement introuvable' })
    await prisma.$transaction(
      ids.map((mid, i) =>
        prisma.meeting.updateMany({ where: { id: mid, eventId }, data: { order: i } }),
      ),
    )
    await logHistory({ eventId, userId, action: 'reordered' })
    return reply.status(204).send()
  })

  // Modification de masse : applique une action à plusieurs réunions d'un événement.
  // actions : setLabel | setDuration | shiftDays | delete
  app.patch('/events/:eventId/meetings/bulk', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const { id: userId } = request.user as { id: string }
    const body = request.body as { ids: string[]; action: 'setLabel' | 'setDuration' | 'shiftDays' | 'delete'; value?: string | number }
    if (!Array.isArray(body.ids) || body.ids.length === 0) return reply.status(400).send({ error: 'Sélection vide' })
    const event = await prisma.meetEvent.findUnique({ where: { id: eventId }, select: { id: true, ownerId: true } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const eventRole = await resolveRole('meetops', eventId, userId, event.ownerId)
    if (eventRole !== 'OWNER' && eventRole !== 'EDITOR') return reply.status(404).send({ error: 'Événement introuvable' })
    // On restreint aux réunions de cet événement (sécurité).
    const owned = await prisma.meeting.findMany({ where: { id: { in: body.ids }, eventId }, select: { id: true, startAt: true } })
    const ids = owned.map((m) => m.id)
    if (ids.length === 0) return reply.status(400).send({ error: 'Aucune réunion valide' })

    let summary = ''
    switch (body.action) {
      case 'setLabel': {
        const label = typeof body.value === 'string' ? body.value.trim() || null : null
        await prisma.meeting.updateMany({ where: { id: { in: ids } }, data: { label } })
        summary = `étiquette → ${label ?? '∅'}`
        break
      }
      case 'setDuration': {
        const durationMin = Math.max(5, Number(body.value) || 0)
        await prisma.meeting.updateMany({ where: { id: { in: ids } }, data: { durationMin } })
        summary = `durée → ${durationMin} min`
        break
      }
      case 'shiftDays': {
        const days = Number(body.value) || 0
        await prisma.$transaction(
          owned.map((m) => prisma.meeting.update({
            where: { id: m.id },
            data: { startAt: new Date(m.startAt.getTime() + days * 86_400_000) },
          })),
        )
        summary = `dates décalées de ${days} j`
        break
      }
      case 'delete': {
        await prisma.meeting.deleteMany({ where: { id: { in: ids } } })
        summary = 'suppression'
        break
      }
      default:
        return reply.status(400).send({ error: 'Action inconnue' })
    }
    await logHistory({ eventId, userId, action: 'bulk', field: body.action, newValue: `${ids.length} réunion(s) — ${summary}` })
    return reply.status(200).send({ affected: ids.length })
  })

  app.patch('/meetings/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    const body = request.body as {
      title?: string
      label?: string | null
      startAt?: string
      durationMin?: number
      location?: string | null
      agenda?: string | null
      status?: MeetingStatus
    }
    const old = await ownedMeeting(id, userId)
    if (!old) return reply.status(404).send({ error: 'Réunion introuvable' })
    const updated = await prisma.meeting.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.label !== undefined ? { label: body.label?.trim() || null } : {}),
        ...(body.startAt !== undefined ? { startAt: new Date(body.startAt) } : {}),
        ...(body.durationMin !== undefined ? { durationMin: body.durationMin } : {}),
        ...(body.location !== undefined ? { location: body.location?.trim() || null } : {}),
        ...(body.agenda !== undefined ? { agenda: body.agenda?.trim() || null } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: { participants: true },
    })
    // Journalise les champs réellement modifiés (titre, étiquette, date, durée).
    const diffs: HistoryEntry[] = []
    const push = (field: string, o: unknown, n: unknown) => {
      if (String(o ?? '') !== String(n ?? '')) diffs.push({ eventId: old.eventId, meetingId: id, meetingTitle: updated.title, userId, action: 'updated', field, oldValue: String(o ?? ''), newValue: String(n ?? '') })
    }
    push('titre', old.title, updated.title)
    push('étiquette', old.label, updated.label)
    push('date', old.startAt.toISOString(), updated.startAt.toISOString())
    push('durée', old.durationMin, updated.durationMin)
    await logHistory(diffs)
    return updated
  })

  app.delete('/meetings/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    const old = await ownedMeeting(id, userId)
    if (!old) return reply.status(404).send({ error: 'Réunion introuvable' })
    await prisma.meeting.delete({ where: { id } })
    await logHistory({ eventId: old.eventId, meetingId: id, meetingTitle: old.title, userId, action: 'deleted' })
    return reply.status(204).send()
  })

  // Vider toutes les réunions d'un événement (avec confirmation côté client)
  app.delete('/events/:eventId/meetings', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const { id: ownerId } = request.user as { id: string }
    const event = await prisma.meetEvent.findFirst({ where: { id: eventId, ownerId } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const { count } = await prisma.meeting.deleteMany({ where: { eventId } })
    await logHistory({ eventId, meetingId: '', meetingTitle: `${count} réunion(s) supprimées`, userId: ownerId, action: 'cleared' })
    return reply.send({ deleted: count })
  })

  // ── Participants ──────────────────────────────────────────────────────────────

  app.post('/meetings/:meetingId/participants', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { meetingId } = request.params as { meetingId: string }
    const { id: userId } = request.user as { id: string }
    const body = request.body as ParticipantInput
    if (!body.email?.trim()) return reply.status(400).send({ error: 'Email requis' })
    if (!(await ownedMeeting(meetingId, userId))) return reply.status(404).send({ error: 'Réunion introuvable' })
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
    const { id: userId } = request.user as { id: string }
    const participant = await prisma.meetingParticipant.findUnique({
      where: { id },
      include: { meeting: { include: { event: { select: { id: true, ownerId: true } } } } },
    })
    if (!participant) return reply.status(404).send({ error: 'Participant introuvable' })
    const role = await resolveRole('meetops', participant.meeting.event.id, userId, participant.meeting.event.ownerId)
    if (role !== 'OWNER' && role !== 'EDITOR') {
      return reply.status(404).send({ error: 'Participant introuvable' })
    }
    await prisma.meetingParticipant.delete({ where: { id } })
    return reply.status(204).send()
  })

  // ── Listes de diffusion ───────────────────────────────────────────────────────
  // Groupes de destinataires réutilisables. eventId null = liste globale de
  // l'utilisateur ; sinon liste locale à un événement. On les applique à une
  // réunion : leurs membres deviennent des participants (dédup par email).

  async function ownedList(listId: string, ownerId: string) {
    const list = await prisma.meetDistList.findUnique({ where: { id: listId } })
    if (!list || list.ownerId !== ownerId) return null
    return list
  }

  app.get('/distlists', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    const { eventId } = request.query as { eventId?: string }
    return prisma.meetDistList.findMany({
      // Listes globales + (si demandé) listes locales à l'événement.
      where: { ownerId, ...(eventId ? { OR: [{ eventId: null }, { eventId }] } : {}) },
      include: { members: true, _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    })
  })

  app.post('/distlists', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as { name: string; eventId?: string | null; members?: ParticipantInput[] }
    if (!body.name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    if (body.eventId) {
      const event = await prisma.meetEvent.findFirst({ where: { id: body.eventId, ownerId } })
      if (!event) return reply.status(400).send({ error: 'Événement invalide' })
    }
    const list = await prisma.meetDistList.create({
      data: {
        ownerId,
        name: body.name.trim(),
        eventId: body.eventId ?? null,
        members: {
          create: (body.members ?? [])
            .filter((m) => m.email?.trim())
            .map((m) => ({ email: m.email.trim(), name: m.name?.trim() || null, role: m.role?.trim() || null })),
        },
      },
      include: { members: true },
    })
    return reply.status(201).send(list)
  })

  app.patch('/distlists/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const { name } = request.body as { name: string }
    if (!(await ownedList(id, ownerId))) return reply.status(404).send({ error: 'Liste introuvable' })
    if (!name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    return prisma.meetDistList.update({ where: { id }, data: { name: name.trim() }, include: { members: true } })
  })

  app.delete('/distlists/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    if (!(await ownedList(id, ownerId))) return reply.status(404).send({ error: 'Liste introuvable' })
    await prisma.meetDistList.delete({ where: { id } })
    return reply.status(204).send()
  })

  app.post('/distlists/:id/members', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as ParticipantInput
    if (!body.email?.trim()) return reply.status(400).send({ error: 'Email requis' })
    if (!(await ownedList(id, ownerId))) return reply.status(404).send({ error: 'Liste introuvable' })
    const member = await prisma.meetDistMember.create({
      data: { listId: id, email: body.email.trim(), name: body.name?.trim() || null, role: body.role?.trim() || null },
    })
    return reply.status(201).send(member)
  })

  app.delete('/distlist-members/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const member = await prisma.meetDistMember.findUnique({ where: { id }, include: { list: { select: { ownerId: true } } } })
    if (!member || member.list.ownerId !== ownerId) return reply.status(404).send({ error: 'Membre introuvable' })
    await prisma.meetDistMember.delete({ where: { id } })
    return reply.status(204).send()
  })

  // Applique une liste à une réunion : crée un MeetingParticipant par membre absent
  // (dédup par email, insensible à la casse).
  app.post('/meetings/:meetingId/apply-list/:listId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { meetingId, listId } = request.params as { meetingId: string; listId: string }
    const { id: userId } = request.user as { id: string }
    if (!(await ownedMeeting(meetingId, userId))) return reply.status(404).send({ error: 'Réunion introuvable' })
    const list = await prisma.meetDistList.findFirst({
      where: { id: listId, ownerId: userId },
      include: { members: true },
    })
    if (!list) return reply.status(404).send({ error: 'Liste introuvable' })

    const existing = await prisma.meetingParticipant.findMany({ where: { meetingId }, select: { email: true } })
    const have = new Set(existing.map((p) => p.email.toLowerCase()))
    const toAdd = list.members.filter((m) => !have.has(m.email.toLowerCase()))
    if (toAdd.length > 0) {
      await prisma.meetingParticipant.createMany({
        data: toAdd.map((m) => ({ meetingId, email: m.email, name: m.name, role: m.role })),
      })
    }
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, include: { participants: true } })
    return reply.status(201).send({ added: toAdd.length, skipped: list.members.length - toAdd.length, meeting })
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
    const { id: userId } = request.user as { id: string }
    const meeting = await prisma.meeting.findUnique({
      where: { id },
      select: { ...MEETING_SELECT, event: { select: { id: true, ownerId: true, owner: { select: { email: true, name: true } } } } },
    })
    if (!meeting) return reply.status(404).send({ error: 'Réunion introuvable' })
    const role = await resolveRole('meetops', meeting.event.id, userId, meeting.event.ownerId)
    if (!role) return reply.status(404).send({ error: 'Réunion introuvable' })
    const owner = meeting.event.owner
    const ics = buildIcsCalendar([toIcs(meeting)], { calendarName: meeting.title, organizerEmail: owner.email, organizerName: owner.name })
    return sendIcs(reply, ics, icsFilename(meeting.title))
  })

  app.get('/events/:id/ics', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    const event = await prisma.meetEvent.findUnique({
      where: { id },
      select: {
        ownerId: true,
        name: true,
        owner: { select: { email: true, name: true } },
        meetings: { orderBy: { startAt: 'asc' }, select: MEETING_SELECT },
      },
    })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const role = await resolveRole('meetops', id, userId, event.ownerId)
    if (!role) return reply.status(404).send({ error: 'Événement introuvable' })
    const ics = buildIcsCalendar(event.meetings.map(toIcs), { calendarName: event.name, organizerEmail: event.owner.email, organizerName: event.owner.name })
    return sendIcs(reply, ics, icsFilename(event.name))
  })

  // ── Connecteur Microsoft Graph (OAuth délégué) ──────────────────────────────────
  const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

  // Renvoie un access token valide pour l'utilisateur (rafraîchi si expiré), ou null
  // s'il n'a pas connecté de compte Microsoft.
  async function getValidAccessToken(userId: string): Promise<string | null> {
    const acct = await prisma.meetGraphAccount.findUnique({ where: { userId } })
    if (!acct) return null
    if (acct.expiresAt.getTime() - Date.now() > 60_000) return decryptSecret(acct.accessToken)
    // Token expiré (ou < 60 s) → refresh + persistance.
    const refreshed = await refreshTokens(decryptSecret(acct.refreshToken))
    await prisma.meetGraphAccount.update({
      where: { userId },
      data: {
        accessToken: encryptSecret(refreshed.accessToken),
        refreshToken: encryptSecret(refreshed.refreshToken || decryptSecret(acct.refreshToken)),
        expiresAt: refreshed.expiresAt,
        scope: refreshed.scope,
      },
    })
    return refreshed.accessToken
  }

  app.get('/graph/status', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const acct = await prisma.meetGraphAccount.findUnique({ where: { userId }, select: { msEmail: true } })
    return { configured: isGraphConfigured, connected: Boolean(acct), email: acct?.msEmail ?? null }
  })

  app.get('/graph/connect', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!isGraphConfigured) return reply.status(400).send({ error: 'Connecteur Microsoft non configuré (variables MS_GRAPH_*)' })
    const { id: userId } = request.user as { id: string }
    // state opaque chiffré (AES-GCM) reliant le callback à l'utilisateur (anti-CSRF + corrélation).
    const state = encryptSecret(JSON.stringify({ uid: userId, t: Date.now() }))
    return { url: buildAuthUrl(state) }
  })

  // Callback OAuth : atteint par le navigateur (pas de header d'auth) → on vérifie le state.
  app.get('/graph/callback', async (request, reply) => {
    const { code, state, error } = request.query as { code?: string; state?: string; error?: string }
    const back = (status: string) => reply.redirect(`${FRONTEND_URL}/meetops?graph=${status}`)
    if (error || !code || !state) return back('error')
    let userId: string
    try {
      const payload = JSON.parse(decryptSecret(state)) as { uid: string; t: number }
      if (!payload.uid || Date.now() - payload.t > 10 * 60_000) return back('error') // state expiré (10 min)
      userId = payload.uid
    } catch {
      return back('error')
    }
    try {
      const tokens: TokenSet = await exchangeCodeForTokens(code)
      const me = await fetchMe(tokens.accessToken)
      await prisma.meetGraphAccount.upsert({
        where: { userId },
        create: {
          userId, msUserId: me.id, msEmail: me.email,
          accessToken: encryptSecret(tokens.accessToken),
          refreshToken: encryptSecret(tokens.refreshToken),
          expiresAt: tokens.expiresAt, scope: tokens.scope,
        },
        update: {
          msUserId: me.id, msEmail: me.email,
          accessToken: encryptSecret(tokens.accessToken),
          refreshToken: encryptSecret(tokens.refreshToken),
          expiresAt: tokens.expiresAt, scope: tokens.scope,
        },
      })
      return back('connected')
    } catch (e) {
      request.log.error({ err: e }, 'graph callback failed')
      return back('error')
    }
  })

  app.delete('/graph/disconnect', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    await prisma.meetGraphAccount.deleteMany({ where: { userId } })
    return reply.status(204).send()
  })

  // ── Envoi Outlook/Teams ─────────────────────────────────────────────────────────

  // Envoie (ou met à jour) une réunion via Graph et persiste le résultat sur la ligne.
  async function sendOneMeeting(meetingId: string, accessToken: string, userId?: string): Promise<void> {
    const m = await prisma.meeting.findUnique({ where: { id: meetingId }, include: { participants: true } })
    if (!m) throw new Error('Réunion introuvable')
    const input: GraphMeetingInput = {
      subject: m.title,
      startAt: m.startAt,
      durationMin: m.durationMin,
      agenda: m.agenda,
      location: m.location,
      attendees: m.participants.map((p) => ({ email: p.email, name: p.name })),
    }
    try {
      const wasSent = Boolean(m.externalId)
      if (m.externalId) {
        const { joinUrl } = await updateTeamsEvent(accessToken, m.externalId, input)
        await prisma.meeting.update({ where: { id: m.id }, data: { status: 'UPDATED', teamsUrl: joinUrl ?? m.teamsUrl, sendError: null } })
      } else {
        const { id, joinUrl } = await createTeamsEvent(accessToken, input)
        await prisma.meeting.update({ where: { id: m.id }, data: { status: 'SENT', externalId: id, teamsUrl: joinUrl, sendError: null } })
      }
      await logHistory({ eventId: m.eventId, meetingId: m.id, meetingTitle: m.title, userId, action: 'sent', newValue: wasSent ? 'mise à jour Outlook/Teams' : 'envoi Outlook/Teams' })
    } catch (e) {
      await prisma.meeting.update({ where: { id: m.id }, data: { sendError: (e as Error).message.slice(0, 500) } })
      throw e
    }
  }

  app.post('/meetings/:id/send', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    if (!isGraphConfigured) return reply.status(400).send({ error: 'Connecteur Microsoft non configuré' })
    if (!(await ownedMeeting(id, userId))) return reply.status(404).send({ error: 'Réunion introuvable' })
    const accessToken = await getValidAccessToken(userId)
    if (!accessToken) return reply.status(400).send({ error: 'Connecte d\'abord ton compte Microsoft' })
    try {
      await sendOneMeeting(id, accessToken, userId)
    } catch (e) {
      return reply.status(502).send({ error: `Échec de l'envoi : ${(e as Error).message}` })
    }
    const meeting = await prisma.meeting.findUnique({ where: { id }, include: { participants: true } })
    return reply.status(200).send(meeting)
  })

  // Envoi de masse : toutes les réunions de l'événement. Continue malgré les échecs
  // (reprise possible sur celles en erreur), renvoie le bilan.
  app.post('/events/:id/send', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    if (!isGraphConfigured) return reply.status(400).send({ error: 'Connecteur Microsoft non configuré' })
    const event = await prisma.meetEvent.findUnique({
      where: { id },
      select: { ownerId: true, meetings: { select: { id: true } } },
    })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const role = await resolveRole('meetops', id, userId, event.ownerId)
    if (role !== 'OWNER' && role !== 'EDITOR') return reply.status(404).send({ error: 'Événement introuvable' })
    const accessToken = await getValidAccessToken(userId)
    if (!accessToken) return reply.status(400).send({ error: 'Connecte d\'abord ton compte Microsoft' })

    const ids = event.meetings.map((m) => m.id)
    let sent = 0
    const failed: string[] = []
    for (const mid of ids) {
      try { await sendOneMeeting(mid, accessToken, userId); sent++ } catch { failed.push(mid) }
    }
    return reply.status(200).send({ total: ids.length, sent, failed: failed.length })
  })

  // ── Historique d'un événement ────────────────────────────────────────────────────

  app.get('/events/:id/history', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: userId } = request.user as { id: string }
    const event = await prisma.meetEvent.findUnique({ where: { id }, select: { id: true, ownerId: true } })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    const role = await resolveRole('meetops', id, userId, event.ownerId)
    if (!role) return reply.status(404).send({ error: 'Événement introuvable' })
    return prisma.meetHistory.findMany({ where: { eventId: id }, orderBy: { createdAt: 'desc' }, take: 200 })
  })

  // ── Calendrier multi-événements ───────────────────────────────────────────────────
  // Renvoie tous les événements de l'utilisateur avec leurs réunions (vue allégée)
  // pour superposer les calendriers.
  app.get('/calendar', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    const shared = await sharedResourceIds('meetops', userId)
    return prisma.meetEvent.findMany({
      where: { OR: [{ ownerId: userId }, { id: { in: shared.map((s) => s.id) } }] },
      select: {
        id: true, name: true, color: true, type: true, status: true,
        meetings: {
          orderBy: [{ order: 'asc' }, { startAt: 'asc' }],
          select: { id: true, title: true, label: true, startAt: true, durationMin: true, status: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })
  })

  // ── Templates ──────────────────────────────────────────────────────────────────────
  // Un template capture les réunions en décalages relatifs (sans dates absolues) :
  // lines = [{ label, title, durationMin, dayOffset, time }] (time = "HH:MM" UTC).

  type TemplateLine = { label: string | null; title: string; durationMin: number; dayOffset: number; time: string }
  const utcMidnight = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  const hhmmUtc = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

  async function ownedTemplate(templateId: string, ownerId: string) {
    const t = await prisma.meetTemplate.findUnique({ where: { id: templateId } })
    if (!t || (t.ownerId !== ownerId && !t.isShared)) return null
    return t
  }

  app.get('/templates', { preHandler: [app.authenticate] }, async (request) => {
    const { id: ownerId } = request.user as { id: string }
    return prisma.meetTemplate.findMany({
      where: { OR: [{ ownerId }, { isShared: true }] },
      include: { _count: { select: { events: true } } },
      orderBy: { name: 'asc' },
    })
  })

  app.post('/templates', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as { name: string; description?: string | null; type?: MeetEventType; color?: string; lines?: TemplateLine[]; isShared?: boolean }
    if (!body.name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    const template = await prisma.meetTemplate.create({
      data: {
        ownerId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        type: body.type ?? 'CUSTOM',
        color: body.color ?? '#475569',
        lines: (body.lines ?? []) as object,
        isShared: body.isShared ?? false,
      },
    })
    return reply.status(201).send(template)
  })

  app.delete('/templates/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const t = await prisma.meetTemplate.findUnique({ where: { id } })
    if (!t || t.ownerId !== ownerId) return reply.status(404).send({ error: 'Template introuvable' })
    await prisma.meetTemplate.delete({ where: { id } })
    return reply.status(204).send()
  })

  // Sauvegarde un événement existant comme template (réunions → décalages relatifs).
  app.post('/events/:id/save-as-template', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as { name: string; description?: string | null }
    if (!body.name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    const event = await prisma.meetEvent.findFirst({
      where: { id, ownerId },
      select: { type: true, color: true, meetings: { orderBy: [{ order: 'asc' }, { startAt: 'asc' }], select: { label: true, title: true, durationMin: true, startAt: true } } },
    })
    if (!event) return reply.status(404).send({ error: 'Événement introuvable' })
    if (event.meetings.length === 0) return reply.status(400).send({ error: 'Aucune réunion à enregistrer' })
    const day0 = Math.min(...event.meetings.map((m) => utcMidnight(m.startAt)))
    const lines: TemplateLine[] = event.meetings.map((m) => ({
      label: m.label,
      title: m.title,
      durationMin: m.durationMin,
      dayOffset: Math.round((utcMidnight(m.startAt) - day0) / 86_400_000),
      time: hhmmUtc(m.startAt),
    }))
    const template = await prisma.meetTemplate.create({
      data: { ownerId, name: body.name.trim(), description: body.description?.trim() || null, type: event.type, color: event.color, lines: lines as object },
    })
    return reply.status(201).send(template)
  })

  // Crée un événement à partir d'un template, à une date de départ donnée.
  app.post('/templates/:id/instantiate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { id: ownerId } = request.user as { id: string }
    const body = request.body as { name: string; startDate: string }
    if (!body.name?.trim()) return reply.status(400).send({ error: 'Nom requis' })
    if (!body.startDate || Number.isNaN(Date.parse(`${body.startDate}T00:00:00Z`))) {
      return reply.status(400).send({ error: 'Date de départ invalide' })
    }
    const template = await ownedTemplate(id, ownerId)
    if (!template) return reply.status(404).send({ error: 'Template introuvable' })
    const lines = (template.lines as unknown as TemplateLine[]) ?? []
    const event = await prisma.meetEvent.create({
      data: {
        ownerId,
        name: body.name.trim(),
        type: template.type,
        color: template.color,
        templateId: template.id,
        meetings: {
          create: lines.map((l, i) => ({
            title: l.title || 'Réunion',
            label: l.label || null,
            durationMin: l.durationMin || 60,
            order: i,
            startAt: new Date(Date.parse(`${body.startDate}T${l.time || '09:00'}:00Z`) + (l.dayOffset || 0) * 86_400_000),
          })),
        },
      },
      include: EVENT_INCLUDE,
    })
    await logHistory({ eventId: event.id, userId: ownerId, action: 'created', newValue: `depuis template « ${template.name} »` })
    return reply.status(201).send(event)
  })
}
