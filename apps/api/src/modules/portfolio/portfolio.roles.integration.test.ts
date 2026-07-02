import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { portfolioRoutes } from './portfolio.routes.js'
import { roadmapRoutes } from '../roadmap/roadmap.routes.js'
import { shareRoutes } from '../../routes/shares.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@portfolio-roles.int.test'

describe('portfolio module — CRUD, rattachement, accès transitif (integration)', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let director: { user: { id: string; email: string }; token: string } // VIEWER sur le portfolio
  let stranger: { user: { id: string }; token: string }
  let portfolioId: string
  let roadmapId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: portfolioRoutes, prefix: '/api/portfolio' },
      { plugin: roadmapRoutes, prefix: '/api/roadmap' },
      { plugin: shareRoutes, prefix: '/api/shares' },
    ])
    owner = await createTestUser(app, `owner${SUFFIX}`)
    director = await createTestUser(app, `director${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    const portfolio = await prisma.portfolio.create({ data: { name: 'Digital 2026', ownerId: owner.user.id } })
    portfolioId = portfolio.id
    await prisma.moduleShare.create({ data: { module: 'portfolio', resourceId: portfolioId, userId: director.user.id, role: 'VIEWER' } })

    const roadmap = await prisma.roadmap.create({
      data: { name: 'Projet A', ownerId: owner.user.id, startDate: '2026-01-01', endDate: '2026-12-31', portfolioId },
    })
    roadmapId = roadmap.id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('hides the portfolio from a stranger', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/portfolio/${portfolioId}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(res.statusCode).toBe(403)
  })

  it('portfolio detail lists its attached roadmaps', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/portfolio/${portfolioId}`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json().roadmaps.map((r: { id: string }) => r.id)).toContain(roadmapId)
  })

  it('a portfolio VIEWER gets transitive read access to the attached roadmap without a direct share', async () => {
    // Pas de ModuleShare direct roadmap→director : uniquement via le portfolio.
    const direct = await prisma.moduleShare.findUnique({
      where: { module_resourceId_userId: { module: 'roadmap', resourceId: roadmapId, userId: director.user.id } },
    })
    expect(direct).toBeNull()

    const res = await app.inject({ method: 'GET', url: `/api/roadmap/${roadmapId}`, headers: { authorization: `Bearer ${director.token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json().role).toBe('VIEWER')
  })

  it('transitive VIEWER cannot edit the roadmap (portfolio role is read-only)', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/roadmap/${roadmapId}/items`,
      headers: { authorization: `Bearer ${director.token}` },
      payload: { name: 'Nope', startDate: '2026-02-01', endDate: '2026-03-01' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('a stranger still has no access to the roadmap despite the portfolio link', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/roadmap/${roadmapId}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(res.statusCode).toBe(403)
  })

  it('rejects attaching a roadmap the caller cannot edit', async () => {
    const foreignOwner = await createTestUser(app, `foreign${SUFFIX}`)
    const foreignRoadmap = await prisma.roadmap.create({
      data: { name: 'Pas à toi', ownerId: foreignOwner.user.id, startDate: '2026-01-01', endDate: '2026-12-31' },
    })
    const res = await app.inject({
      method: 'POST', url: `/api/portfolio/${portfolioId}/roadmaps`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { roadmapId: foreignRoadmap.id },
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects attaching a roadmap to a portfolio the caller cannot edit', async () => {
    const ownRoadmap = await prisma.roadmap.create({
      data: { name: 'À moi', ownerId: director.user.id, startDate: '2026-01-01', endDate: '2026-12-31' },
    })
    // director n'est que VIEWER sur le portfolio → ne peut pas y rattacher.
    const res = await app.inject({
      method: 'POST', url: `/api/portfolio/${portfolioId}/roadmaps`,
      headers: { authorization: `Bearer ${director.token}` },
      payload: { roadmapId: ownRoadmap.id },
    })
    expect(res.statusCode).toBe(403)
  })

  it('owner can attach and detach a roadmap; detaching preserves the roadmap', async () => {
    const rm = await prisma.roadmap.create({ data: { name: 'Détachable', ownerId: owner.user.id, startDate: '2026-01-01', endDate: '2026-12-31' } })
    const attach = await app.inject({
      method: 'POST', url: `/api/portfolio/${portfolioId}/roadmaps`,
      headers: { authorization: `Bearer ${owner.token}` }, payload: { roadmapId: rm.id },
    })
    expect(attach.statusCode).toBe(204)
    expect((await prisma.roadmap.findUnique({ where: { id: rm.id } }))?.portfolioId).toBe(portfolioId)

    const detach = await app.inject({
      method: 'DELETE', url: `/api/portfolio/${portfolioId}/roadmaps/${rm.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    })
    expect(detach.statusCode).toBe(204)
    const after = await prisma.roadmap.findUnique({ where: { id: rm.id } })
    expect(after).not.toBeNull() // toujours là, juste détachée
    expect(after?.portfolioId).toBeNull()
  })

  it('deleting the portfolio detaches its roadmaps instead of deleting them', async () => {
    const pf = await prisma.portfolio.create({ data: { name: 'Éphémère', ownerId: owner.user.id } })
    const rm = await prisma.roadmap.create({ data: { name: 'Survit', ownerId: owner.user.id, startDate: '2026-01-01', endDate: '2026-12-31', portfolioId: pf.id } })

    const del = await app.inject({ method: 'DELETE', url: `/api/portfolio/${pf.id}`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(del.statusCode).toBe(204)

    const survived = await prisma.roadmap.findUnique({ where: { id: rm.id } })
    expect(survived).not.toBeNull()
    expect(survived?.portfolioId).toBeNull()
  })

  it('only the owner can delete the portfolio (404 for a non-owner, anti-énumération)', async () => {
    const ko = await app.inject({ method: 'DELETE', url: `/api/portfolio/${portfolioId}`, headers: { authorization: `Bearer ${director.token}` } })
    expect(ko.statusCode).toBe(404)
  })
})
