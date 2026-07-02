import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { roadmapRoutes } from './roadmap.routes.js'
import { portfolioRoutes } from '../portfolio/portfolio.routes.js'
import { prisma } from '../../lib/prisma.js'

// Couche A du durcissement Roadmap : validation des deps (existence, cycles),
// et champs status/assigneeId.
const SUFFIX = '@roadmap-hardening.int.test'

describe('roadmap hardening — deps validation, cycles, status, assignee (integration)', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let outsider: { user: { id: string }; token: string }
  let roadmapId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: roadmapRoutes, prefix: '/api/roadmap' },
      { plugin: portfolioRoutes, prefix: '/api/portfolio' },
    ])
    owner = await createTestUser(app, `owner${SUFFIX}`)
    outsider = await createTestUser(app, `outsider${SUFFIX}`)
    const roadmap = await prisma.roadmap.create({
      data: { name: 'Hardening roadmap', ownerId: owner.user.id, startDate: '2026-01-01', endDate: '2026-12-31' },
    })
    roadmapId = roadmap.id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  async function createItem(payload: Record<string, unknown>) {
    return app.inject({ method: 'POST', url: `/api/roadmap/${roadmapId}/items`, headers: { authorization: `Bearer ${owner.token}` }, payload })
  }

  it('rejects a dep referencing an unknown item id', async () => {
    const res = await createItem({ name: 'A', startDate: '2026-01-01', endDate: '2026-02-01', deps: ['not-an-item'] })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/inconnue/i)
  })

  it('rejects self-dependency', async () => {
    const a = await createItem({ name: 'B', startDate: '2026-01-01', endDate: '2026-02-01' })
    const aId = a.json().id
    const res = await app.inject({
      method: 'PATCH', url: `/api/roadmap/${roadmapId}/items/${aId}`,
      headers: { authorization: `Bearer ${owner.token}` }, payload: { deps: [aId] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/lui-même/i)
  })

  it('rejects a direct cycle (A→B, then B→A)', async () => {
    const a = await createItem({ name: 'C', startDate: '2026-01-01', endDate: '2026-02-01' })
    const aId = a.json().id
    const b = await createItem({ name: 'D', startDate: '2026-02-01', endDate: '2026-03-01', deps: [aId] })
    const bId = b.json().id

    const res = await app.inject({
      method: 'PATCH', url: `/api/roadmap/${roadmapId}/items/${aId}`,
      headers: { authorization: `Bearer ${owner.token}` }, payload: { deps: [bId] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/boucle/i)
  })

  it('rejects a transitive cycle (A→B→C, then C→A)', async () => {
    const a = await createItem({ name: 'E', startDate: '2026-01-01', endDate: '2026-02-01' })
    const aId = a.json().id
    const b = await createItem({ name: 'F', startDate: '2026-02-01', endDate: '2026-03-01', deps: [aId] })
    const bId = b.json().id
    const c = await createItem({ name: 'G', startDate: '2026-03-01', endDate: '2026-04-01', deps: [bId] })
    const cId = c.json().id

    const res = await app.inject({
      method: 'PATCH', url: `/api/roadmap/${roadmapId}/items/${aId}`,
      headers: { authorization: `Bearer ${owner.token}` }, payload: { deps: [cId] },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/boucle/i)
  })

  it('accepts a valid non-cyclic dependency chain', async () => {
    const a = await createItem({ name: 'H', startDate: '2026-01-01', endDate: '2026-02-01' })
    const aId = a.json().id
    const b = await createItem({ name: 'I', startDate: '2026-02-01', endDate: '2026-03-01', deps: [aId] })
    expect(b.statusCode).toBe(201)
    expect(b.json().deps).toEqual([aId])
  })

  it('creates and updates status', async () => {
    const created = await createItem({ name: 'J', startDate: '2026-01-01', endDate: '2026-02-01', status: 'DOING' })
    expect(created.statusCode).toBe(201)
    expect(created.json().status).toBe('DOING')

    const itemId = created.json().id
    const updated = await app.inject({
      method: 'PATCH', url: `/api/roadmap/${roadmapId}/items/${itemId}`,
      headers: { authorization: `Bearer ${owner.token}` }, payload: { status: 'DONE' },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json().status).toBe('DONE')
  })

  it('defaults status to TODO when omitted', async () => {
    const created = await createItem({ name: 'K', startDate: '2026-01-01', endDate: '2026-02-01' })
    expect(created.json().status).toBe('TODO')
  })

  it('rejects assigning someone with no access to the roadmap', async () => {
    const res = await createItem({ name: 'L', startDate: '2026-01-01', endDate: '2026-02-01', assigneeId: outsider.user.id })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/assigné/i)
  })

  it('accepts assigning the owner themselves', async () => {
    const res = await createItem({ name: 'M', startDate: '2026-01-01', endDate: '2026-02-01', assigneeId: owner.user.id })
    expect(res.statusCode).toBe(201)
    expect(res.json().assigneeId).toBe(owner.user.id)
  })

  it('accepts assigning a user shared on the roadmap', async () => {
    const collaborator = await createTestUser(app, `collab${SUFFIX}`)
    await prisma.moduleShare.create({ data: { module: 'roadmap', resourceId: roadmapId, userId: collaborator.user.id, role: 'VIEWER' } })
    const res = await createItem({ name: 'N', startDate: '2026-01-01', endDate: '2026-02-01', assigneeId: collaborator.user.id })
    expect(res.statusCode).toBe(201)
    expect(res.json().assigneeId).toBe(collaborator.user.id)
  })
})
