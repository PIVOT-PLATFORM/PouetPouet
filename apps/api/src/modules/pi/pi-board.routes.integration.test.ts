import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { piBoardRoutes, wouldCreateDependencyCycle } from './pi-board.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@pi.board.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('wouldCreateDependencyCycle — détection de boucles', () => {
  it('détecte une boucle directe et transitive, laisse passer le reste', () => {
    const edges = [
      { fromTicketId: 'a', toTicketId: 'b' },
      { fromTicketId: 'b', toTicketId: 'c' },
    ]
    expect(wouldCreateDependencyCycle(edges, 'b', 'a')).toBe(true) // boucle directe a→b + b→a
    expect(wouldCreateDependencyCycle(edges, 'c', 'a')).toBe(true) // boucle transitive a→b→c + c→a
    expect(wouldCreateDependencyCycle(edges, 'a', 'c')).toBe(false) // raccourci dans le même sens
    expect(wouldCreateDependencyCycle([], 'x', 'y')).toBe(false)
  })
})

describe('Program Board — tickets, dépendances, permissions', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let editor: { user: { id: string }; token: string }
  let viewer: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let cycleId: string
  let otherCycleId: string
  let teamId: string
  let iterationId: string
  let otherTeamId: string
  let ticketA: string
  let ticketB: string
  let ticketC: string
  let depId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: piBoardRoutes, prefix: '/api/pi' }])
    owner = await createTestUser(app, `owner${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    // Deux cycles créés directement en base (les routes de création sont testées dans pi.routes).
    const cycle = await prisma.piCycle.create({
      data: {
        name: 'PI Board Test', ownerId: owner.user.id,
        startDate: new Date('2026-10-01'), endDate: new Date('2026-11-25'),
        iterations: { create: [
          { number: 1, label: 'IT1', startDate: new Date('2026-10-01'), endDate: new Date('2026-10-14') },
          { number: 2, label: 'IT2', startDate: new Date('2026-10-15'), endDate: new Date('2026-10-28') },
        ] },
        teams: { create: [{ name: 'Atlas', order: 0 }] },
      },
      include: { iterations: true, teams: true },
    })
    cycleId = cycle.id
    teamId = cycle.teams[0].id
    iterationId = cycle.iterations[0].id

    const other = await prisma.piCycle.create({
      data: {
        name: 'Autre PI', ownerId: owner.user.id,
        startDate: new Date('2027-01-01'), endDate: new Date('2027-02-25'),
        teams: { create: [{ name: 'Orion', order: 0 }] },
      },
      include: { teams: true },
    })
    otherCycleId = other.id
    otherTeamId = other.teams[0].id

    await prisma.moduleShare.create({ data: { module: 'pi', resourceId: cycleId, userId: editor.user.id, role: 'EDITOR' } })
    await prisma.moduleShare.create({ data: { module: 'pi', resourceId: cycleId, userId: viewer.user.id, role: 'VIEWER' } })
  })

  afterAll(async () => {
    await prisma.piCycle.deleteMany({ where: { id: { in: [cycleId, otherCycleId] } } })
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  // ── Tickets ────────────────────────────────────────────────────────────────

  it('POST /cycles/:id/tickets — crée un ticket dans une cellule, ordre incrémental', async () => {
    const a = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/tickets`, headers: auth(owner.token),
      payload: { type: 'FEATURE', title: 'Paiement en ligne', teamId, iterationId },
    })
    expect(a.statusCode).toBe(201)
    ticketA = a.json().id
    expect(a.json().order).toBe(0)

    const b = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/tickets`, headers: auth(editor.token),
      payload: { type: 'STORY', title: 'API de paiement', teamId, iterationId },
    })
    expect(b.statusCode).toBe(201)
    ticketB = b.json().id
    expect(b.json().order).toBe(1)

    // Ligne Train (teamId null) + Non planifié (iterationId null).
    const c = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/tickets`, headers: auth(owner.token),
      payload: { type: 'MILESTONE', title: 'Go-live', },
    })
    expect(c.statusCode).toBe(201)
    ticketC = c.json().id
    expect(c.json().teamId).toBeNull()
    expect(c.json().iterationId).toBeNull()
    expect(c.json().order).toBe(0) // cellule distincte → compteur distinct
  })

  it('POST tickets — le VIEWER ne peut pas créer (403), l\'étranger reçoit 404', async () => {
    const refused = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/tickets`, headers: auth(viewer.token),
      payload: { type: 'RISK', title: 'pirate' },
    })
    expect(refused.statusCode).toBe(403)
    const hidden = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/tickets`, headers: auth(stranger.token),
      payload: { type: 'RISK', title: 'pirate' },
    })
    expect(hidden.statusCode).toBe(404)
  })

  it('POST tickets — refuse une équipe ou une itération d\'un autre cycle (400)', async () => {
    const badTeam = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/tickets`, headers: auth(owner.token),
      payload: { type: 'FEATURE', title: 'x', teamId: otherTeamId },
    })
    expect(badTeam.statusCode).toBe(400)
  })

  it('PATCH tickets — déplace un ticket vers une autre cellule', async () => {
    const detail = await prisma.piIteration.findFirst({ where: { cycleId, number: 2 } })
    const res = await app.inject({
      method: 'PATCH', url: `/api/pi/cycles/${cycleId}/tickets/${ticketA}`, headers: auth(editor.token),
      payload: { iterationId: detail!.id, order: 0 },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().iterationId).toBe(detail!.id)
  })

  it('PATCH tickets — ticket d\'un autre cycle introuvable (404)', async () => {
    const foreign = await prisma.piTicket.create({ data: { cycleId: otherCycleId, type: 'STORY', title: 'ailleurs', order: 0 } })
    const res = await app.inject({
      method: 'PATCH', url: `/api/pi/cycles/${cycleId}/tickets/${foreign.id}`, headers: auth(owner.token),
      payload: { title: 'piraté' },
    })
    expect(res.statusCode).toBe(404)
  })

  // ── Dépendances ────────────────────────────────────────────────────────────

  it('POST /cycles/:id/dependencies — crée une dépendance OK puis la passe BLOCKED', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/dependencies`, headers: auth(owner.token),
      payload: { fromTicketId: ticketB, toTicketId: ticketA },
    })
    expect(res.statusCode).toBe(201)
    depId = res.json().id
    expect(res.json().status).toBe('OK')

    const patched = await app.inject({
      method: 'PATCH', url: `/api/pi/cycles/${cycleId}/dependencies/${depId}`, headers: auth(editor.token),
      payload: { status: 'BLOCKED', note: 'API bloquante non livrée' },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json().status).toBe('BLOCKED')
  })

  it('POST dependencies — refuse self, doublon, boucle et ticket hors cycle (400)', async () => {
    const self = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/dependencies`, headers: auth(owner.token),
      payload: { fromTicketId: ticketA, toTicketId: ticketA },
    })
    expect(self.statusCode).toBe(400)

    const duplicate = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/dependencies`, headers: auth(owner.token),
      payload: { fromTicketId: ticketB, toTicketId: ticketA },
    })
    expect(duplicate.statusCode).toBe(400)

    // B→A existe ; ajouter A→C puis C→B fermerait la boucle B→A→C→B.
    const ac = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/dependencies`, headers: auth(owner.token),
      payload: { fromTicketId: ticketA, toTicketId: ticketC },
    })
    expect(ac.statusCode).toBe(201)
    const loop = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/dependencies`, headers: auth(owner.token),
      payload: { fromTicketId: ticketC, toTicketId: ticketB },
    })
    expect(loop.statusCode).toBe(400)
    expect(loop.json().error).toContain('boucle')

    const foreign = await prisma.piTicket.findFirst({ where: { cycleId: otherCycleId } })
    const crossCycle = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/dependencies`, headers: auth(owner.token),
      payload: { fromTicketId: ticketA, toTicketId: foreign!.id },
    })
    expect(crossCycle.statusCode).toBe(400)
  })

  it('le VIEWER ne peut pas créer de dépendance (403)', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/dependencies`, headers: auth(viewer.token),
      payload: { fromTicketId: ticketA, toTicketId: ticketB },
    })
    expect(res.statusCode).toBe(403)
  })

  // ── Board complet ──────────────────────────────────────────────────────────

  it('GET /cycles/:id/board — payload unique, VIEWER inclus, étranger 403', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/pi/cycles/${cycleId}/board`, headers: auth(viewer.token) })
    expect(res.statusCode).toBe(200)
    const board = res.json()
    expect(board.role).toBe('VIEWER')
    expect(board.iterations).toHaveLength(2)
    expect(board.teams).toHaveLength(1)
    expect(board.tickets.map((t: { id: string }) => t.id)).toContain(ticketA)
    expect(board.dependencies).toHaveLength(2)

    const refused = await app.inject({ method: 'GET', url: `/api/pi/cycles/${cycleId}/board`, headers: auth(stranger.token) })
    expect(refused.statusCode).toBe(403)
  })

  // ── Cascades ───────────────────────────────────────────────────────────────

  it('DELETE ticket — supprime ses dépendances en cascade', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/pi/cycles/${cycleId}/tickets/${ticketA}`, headers: auth(owner.token) })
    expect(res.statusCode).toBe(204)
    // B→A et A→C portées par A disparaissent avec lui.
    expect(await prisma.piDependency.count({ where: { cycleId } })).toBe(0)
  })

  it('DELETE dependency — suppression directe', async () => {
    const dep = await app.inject({
      method: 'POST', url: `/api/pi/cycles/${cycleId}/dependencies`, headers: auth(owner.token),
      payload: { fromTicketId: ticketB, toTicketId: ticketC },
    })
    expect(dep.statusCode).toBe(201)
    const res = await app.inject({ method: 'DELETE', url: `/api/pi/cycles/${cycleId}/dependencies/${dep.json().id}`, headers: auth(owner.token) })
    expect(res.statusCode).toBe(204)
  })

  it('la suppression d\'une itération détache les tickets (SetNull) sans les supprimer', async () => {
    const it2 = await prisma.piIteration.findFirst({ where: { cycleId, number: 2 } })
    // ticketB est resté en IT1 ; on recrée un ticket en IT2 pour le test.
    const parked = await prisma.piTicket.create({ data: { cycleId, type: 'ENABLER', title: 'Infra CI', iterationId: it2!.id, order: 0 } })
    await prisma.piIteration.delete({ where: { id: it2!.id } })
    const after = await prisma.piTicket.findUnique({ where: { id: parked.id } })
    expect(after).not.toBeNull()
    expect(after?.iterationId).toBeNull()
  })
})
