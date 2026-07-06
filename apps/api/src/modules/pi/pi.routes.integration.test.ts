import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { piRoutes, generateIterations } from './pi.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@pi.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('generateIterations — génération des créneaux', () => {
  it('génère N itérations consécutives + un IP Sprint', () => {
    const start = new Date('2026-09-01T00:00:00.000Z')
    const iterations = generateIterations(start, 5, 2)
    expect(iterations).toHaveLength(6)
    expect(iterations.map((i) => i.label)).toEqual(['IT1', 'IT2', 'IT3', 'IT4', 'IT5', 'IP Sprint'])
    expect(iterations.map((i) => i.number)).toEqual([1, 2, 3, 4, 5, 6])
    // Créneaux contigus de 14 jours : IT1 = 01→14, IT2 démarre le 15…
    expect(iterations[0].startDate.toISOString().slice(0, 10)).toBe('2026-09-01')
    expect(iterations[0].endDate.toISOString().slice(0, 10)).toBe('2026-09-14')
    expect(iterations[1].startDate.toISOString().slice(0, 10)).toBe('2026-09-15')
    // L'IP Sprint suit immédiatement la dernière itération.
    expect(iterations[5].startDate.getTime()).toBe(iterations[4].endDate.getTime() + 86_400_000)
  })
})

describe('PI Planning — cycles, permissions, équipes, intégrations', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let editor: { user: { id: string }; token: string }
  let viewer: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let cycleId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: piRoutes, prefix: '/api/pi' }])
    owner = await createTestUser(app, `owner${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('POST /cycles → 201, itérations générées automatiquement', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/pi/cycles', headers: auth(owner.token),
      payload: { name: 'PI 2026.Q4', artName: 'Train Alpha', startDate: '2026-10-01', iterationCount: 3, iterationWeeks: 2, eventDay1: '2026-09-29', eventDay2: '2026-09-30' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    cycleId = body.id
    expect(body.role).toBe('OWNER')
    expect(body.iterations).toHaveLength(4) // IT1..IT3 + IP Sprint
    expect(body.iterations[3].label).toBe('IP Sprint')
    // endDate du cycle = fin de l'IP Sprint.
    expect(body.endDate).toBe(body.iterations[3].endDate)

    await prisma.moduleShare.create({ data: { module: 'pi', resourceId: cycleId, userId: editor.user.id, role: 'EDITOR' } })
    await prisma.moduleShare.create({ data: { module: 'pi', resourceId: cycleId, userId: viewer.user.id, role: 'VIEWER' } })
  })

  it('GET /cycles/:id — un étranger n\'a pas accès → 403', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/pi/cycles/${cycleId}`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })

  it('GET /cycles/:id — le VIEWER partagé voit le PI', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/pi/cycles/${cycleId}`, headers: auth(viewer.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().role).toBe('VIEWER')
  })

  it('PATCH /cycles/:id — le VIEWER ne peut pas éditer → 403, l\'EDITOR oui', async () => {
    const refused = await app.inject({ method: 'PATCH', url: `/api/pi/cycles/${cycleId}`, headers: auth(viewer.token), payload: { name: 'pirate' } })
    expect(refused.statusCode).toBe(403)
    const ok = await app.inject({ method: 'PATCH', url: `/api/pi/cycles/${cycleId}`, headers: auth(editor.token), payload: { status: 'ACTIVE' } })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().status).toBe('ACTIVE')
  })

  it('PATCH /cycles/:id/iterations/:iterationId — ajuste label et dates', async () => {
    const detail = await app.inject({ method: 'GET', url: `/api/pi/cycles/${cycleId}`, headers: auth(owner.token) })
    const it1 = detail.json().iterations[0]
    const res = await app.inject({
      method: 'PATCH', url: `/api/pi/cycles/${cycleId}/iterations/${it1.id}`, headers: auth(owner.token),
      payload: { label: 'Sprint 42', endDate: '2026-10-16' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().label).toBe('Sprint 42')
  })

  it('PATCH iterations — début après fin → 400', async () => {
    const detail = await app.inject({ method: 'GET', url: `/api/pi/cycles/${cycleId}`, headers: auth(owner.token) })
    const it1 = detail.json().iterations[0]
    const res = await app.inject({
      method: 'PATCH', url: `/api/pi/cycles/${cycleId}/iterations/${it1.id}`, headers: auth(owner.token),
      payload: { startDate: '2026-12-31', endDate: '2026-01-01' },
    })
    expect(res.statusCode).toBe(400)
  })

  // ── Équipes ────────────────────────────────────────────────────────────────

  it('POST /cycles/:id/teams — ajout manuel avec ordre croissant', async () => {
    const a = await app.inject({ method: 'POST', url: `/api/pi/cycles/${cycleId}/teams`, headers: auth(owner.token), payload: { name: 'Équipe Atlas' } })
    const b = await app.inject({ method: 'POST', url: `/api/pi/cycles/${cycleId}/teams`, headers: auth(editor.token), payload: { name: 'Équipe Orion', color: '#ff0000' } })
    expect(a.statusCode).toBe(201)
    expect(b.statusCode).toBe(201)
    expect(b.json().order).toBeGreaterThan(a.json().order)
  })

  it('POST /cycles/:id/teams/import — copie une équipe pivot accessible, refuse une équipe étrangère', async () => {
    const myTeam = await prisma.team.create({ data: { name: 'Pivot Alpha', ownerId: owner.user.id, color: '#00ff00' } })
    const foreignTeam = await prisma.team.create({ data: { name: 'Pivot Étranger', ownerId: stranger.user.id } })

    const ok = await app.inject({ method: 'POST', url: `/api/pi/cycles/${cycleId}/teams/import`, headers: auth(owner.token), payload: { teamIds: [myTeam.id] } })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().imported).toBe(1)
    const imported = await prisma.piCycleTeam.findFirst({ where: { cycleId, sourceTeamId: myTeam.id } })
    expect(imported?.name).toBe('Pivot Alpha')
    expect(imported?.color).toBe('#00ff00')

    // Ré-import de la même équipe : ignoré silencieusement.
    const again = await app.inject({ method: 'POST', url: `/api/pi/cycles/${cycleId}/teams/import`, headers: auth(owner.token), payload: { teamIds: [myTeam.id] } })
    expect(again.json().imported).toBe(0)

    const refused = await app.inject({ method: 'POST', url: `/api/pi/cycles/${cycleId}/teams/import`, headers: auth(owner.token), payload: { teamIds: [foreignTeam.id] } })
    expect(refused.statusCode).toBe(403)
  })

  it('DELETE /cycles/:id/teams/:teamId — retire une équipe du Train', async () => {
    const team = await prisma.piCycleTeam.findFirst({ where: { cycleId, name: 'Équipe Orion' } })
    const res = await app.inject({ method: 'DELETE', url: `/api/pi/cycles/${cycleId}/teams/${team!.id}`, headers: auth(owner.token) })
    expect(res.statusCode).toBe(204)
  })

  // ── Intégration Formulaires ────────────────────────────────────────────────

  it('POST /cycles/:id/logistics-form — crée le formulaire template dans Forms et le rattache', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/pi/cycles/${cycleId}/logistics-form`, headers: auth(owner.token) })
    expect(res.statusCode).toBe(201)
    const { formId } = res.json()

    const form = await prisma.form.findUnique({ where: { id: formId } })
    expect(form?.isPublished).toBe(true)
    expect(form?.ownerId).toBe(owner.user.id)
    const fields = form?.fields as { id: string; type: string }[]
    expect(fields.map((f) => f.id)).toEqual(['presence', 'hotel', 'repas', 'allergies'])

    const cycle = await prisma.piCycle.findUnique({ where: { id: cycleId } })
    expect(cycle?.logisticsFormId).toBe(formId)
  })

  it('POST /cycles/:id/logistics-form — refuse un second formulaire (400)', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/pi/cycles/${cycleId}/logistics-form`, headers: auth(owner.token) })
    expect(res.statusCode).toBe(400)
  })

  it('GET /cycles/:id — résume le formulaire logistique lié', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/pi/cycles/${cycleId}`, headers: auth(owner.token) })
    const { logisticsForm } = res.json()
    expect(logisticsForm).not.toBeNull()
    expect(logisticsForm.recipientCount).toBe(0)
    expect(logisticsForm.respondedCount).toBe(0)
  })

  // ── Intégration To-Do ──────────────────────────────────────────────────────

  it('POST /cycles/:id/todo-dashboard — crée le tableau des tâches et le rattache', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/pi/cycles/${cycleId}/todo-dashboard`, headers: auth(owner.token) })
    expect(res.statusCode).toBe(201)
    const { dashboardId } = res.json()
    const dashboard = await prisma.todoDashboard.findUnique({ where: { id: dashboardId } })
    expect(dashboard?.ownerId).toBe(owner.user.id)
    const cycle = await prisma.piCycle.findUnique({ where: { id: cycleId } })
    expect(cycle?.todoDashboardId).toBe(dashboardId)
  })

  it('PATCH /cycles/:id — refuser de lier un TodoDashboard inaccessible (403)', async () => {
    const privateDb = await prisma.todoDashboard.create({ data: { name: 'Privé', ownerId: stranger.user.id } })
    const res = await app.inject({ method: 'PATCH', url: `/api/pi/cycles/${cycleId}`, headers: auth(owner.token), payload: { todoDashboardId: privateDb.id } })
    expect(res.statusCode).toBe(403)
  })

  // ── Suppression ────────────────────────────────────────────────────────────

  it('DELETE /cycles/:id — un EDITOR ne peut pas supprimer (404 anti-énumération), le propriétaire oui ; le Form et le TodoDashboard liés survivent', async () => {
    const cycleBefore = await prisma.piCycle.findUnique({ where: { id: cycleId } })
    const refused = await app.inject({ method: 'DELETE', url: `/api/pi/cycles/${cycleId}`, headers: auth(editor.token) })
    expect(refused.statusCode).toBe(404)

    const ok = await app.inject({ method: 'DELETE', url: `/api/pi/cycles/${cycleId}`, headers: auth(owner.token) })
    expect(ok.statusCode).toBe(204)

    // Les ressources liées (autres modules) ne sont pas supprimées.
    expect(await prisma.form.findUnique({ where: { id: cycleBefore!.logisticsFormId! } })).not.toBeNull()
    expect(await prisma.todoDashboard.findUnique({ where: { id: cycleBefore!.todoDashboardId! } })).not.toBeNull()
    // Les itérations et équipes du Train, elles, sont supprimées en cascade.
    expect(await prisma.piIteration.count({ where: { cycleId } })).toBe(0)
    expect(await prisma.piCycleTeam.count({ where: { cycleId } })).toBe(0)
  })
})
