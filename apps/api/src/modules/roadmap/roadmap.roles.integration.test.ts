import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { roadmapRoutes } from './roadmap.routes.js'
import { shareRoutes } from '../../routes/shares.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@roadmap-roles.int.test'

describe('roadmap module permissions (integration)', () => {
  let app: FastifyInstance
  let creator: { user: { id: string }; token: string }
  let editor: { user: { id: string; email: string }; token: string }
  let viewer: { user: { id: string; email: string }; token: string }
  let stranger: { user: { id: string; email: string }; token: string }
  let roadmapId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: roadmapRoutes, prefix: '/api/roadmap' },
      { plugin: shareRoutes, prefix: '/api/shares' },
    ])
    creator = await createTestUser(app, `creator${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    const roadmap = await prisma.roadmap.create({
      data: { name: 'Roles roadmap', ownerId: creator.user.id, startDate: '2026-01-01', endDate: '2026-12-31' },
    })
    roadmapId = roadmap.id
    await prisma.moduleShare.createMany({
      data: [
        { module: 'roadmap', resourceId: roadmapId, userId: editor.user.id, role: 'EDITOR' },
        { module: 'roadmap', resourceId: roadmapId, userId: viewer.user.id, role: 'VIEWER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('lists shared roadmaps with their role', async () => {
    const ed = await app.inject({ method: 'GET', url: '/api/roadmap', headers: { authorization: `Bearer ${editor.token}` } })
    expect(ed.statusCode).toBe(200)
    expect(ed.json().find((r: { id: string }) => r.id === roadmapId)?.role).toBe('EDITOR')

    const vw = await app.inject({ method: 'GET', url: '/api/roadmap', headers: { authorization: `Bearer ${viewer.token}` } })
    expect(vw.json().find((r: { id: string }) => r.id === roadmapId)?.role).toBe('VIEWER')
  })

  it('hides the roadmap from a stranger', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/roadmap', headers: { authorization: `Bearer ${stranger.token}` } })
    expect(res.json().find((r: { id: string }) => r.id === roadmapId)).toBeUndefined()
    const detail = await app.inject({ method: 'GET', url: `/api/roadmap/${roadmapId}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(detail.statusCode).toBe(403)
  })

  it('viewer reads the detail but cannot create items', async () => {
    const read = await app.inject({ method: 'GET', url: `/api/roadmap/${roadmapId}`, headers: { authorization: `Bearer ${viewer.token}` } })
    expect(read.statusCode).toBe(200)
    expect(read.json().role).toBe('VIEWER')

    const ko = await app.inject({
      method: 'POST', url: `/api/roadmap/${roadmapId}/items`,
      headers: { authorization: `Bearer ${viewer.token}` },
      payload: { name: 'Nope', startDate: '2026-02-01', endDate: '2026-03-01' },
    })
    expect(ko.statusCode).toBe(403)
  })

  it('editor can create and update items, viewer cannot', async () => {
    const created = await app.inject({
      method: 'POST', url: `/api/roadmap/${roadmapId}/items`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { name: 'Migration', startDate: '2026-02-01', endDate: '2026-06-30', risk: 'high', prio: 'must', categories: ['infra'] },
    })
    expect(created.statusCode).toBe(201)
    const itemId = created.json().id

    const ok = await app.inject({
      method: 'PATCH', url: `/api/roadmap/${roadmapId}/items/${itemId}`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { risk: 'med' },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().risk).toBe('med')

    const ko = await app.inject({
      method: 'PATCH', url: `/api/roadmap/${roadmapId}/items/${itemId}`,
      headers: { authorization: `Bearer ${viewer.token}` },
      payload: { risk: 'low' },
    })
    expect(ko.statusCode).toBe(403)
  })

  it('rejects an item whose start is after its end', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/roadmap/${roadmapId}/items`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { name: 'Inversé', startDate: '2026-06-01', endDate: '2026-03-01' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('deleting an item clears it from other items deps', async () => {
    const a = await app.inject({ method: 'POST', url: `/api/roadmap/${roadmapId}/items`, headers: { authorization: `Bearer ${creator.token}` }, payload: { name: 'A', startDate: '2026-01-05', endDate: '2026-02-05' } })
    const aId = a.json().id
    const b = await app.inject({ method: 'POST', url: `/api/roadmap/${roadmapId}/items`, headers: { authorization: `Bearer ${creator.token}` }, payload: { name: 'B', startDate: '2026-03-05', endDate: '2026-04-05', deps: [aId] } })
    const bId = b.json().id

    const del = await app.inject({ method: 'DELETE', url: `/api/roadmap/${roadmapId}/items/${aId}`, headers: { authorization: `Bearer ${creator.token}` } })
    expect(del.statusCode).toBe(204)

    const after = await prisma.roadmapItem.findUnique({ where: { id: bId } })
    expect(after?.deps).not.toContain(aId)
  })

  it('only the owner can delete the roadmap; deletion cleans up shares', async () => {
    const ko = await app.inject({ method: 'DELETE', url: `/api/roadmap/${roadmapId}`, headers: { authorization: `Bearer ${editor.token}` } })
    expect(ko.statusCode).toBe(404)

    const tmp = await prisma.roadmap.create({ data: { name: 'Temp', ownerId: creator.user.id, startDate: '2026-01-01', endDate: '2026-12-31' } })
    await prisma.moduleShare.create({ data: { module: 'roadmap', resourceId: tmp.id, userId: editor.user.id, role: 'EDITOR' } })
    const ok = await app.inject({ method: 'DELETE', url: `/api/roadmap/${tmp.id}`, headers: { authorization: `Bearer ${creator.token}` } })
    expect(ok.statusCode).toBe(204)
    expect(await prisma.moduleShare.count({ where: { module: 'roadmap', resourceId: tmp.id } })).toBe(0)
  })

  it('share management: owner can invite, editor cannot', async () => {
    const ko = await app.inject({
      method: 'POST', url: `/api/shares/roadmap/${roadmapId}/invite`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { email: stranger.user.email, role: 'VIEWER' },
    })
    expect(ko.statusCode).toBe(403)

    const ok = await app.inject({
      method: 'POST', url: `/api/shares/roadmap/${roadmapId}/invite`,
      headers: { authorization: `Bearer ${creator.token}` },
      payload: { email: stranger.user.email, role: 'VIEWER' },
    })
    expect(ok.statusCode).toBe(201)
  })
})
