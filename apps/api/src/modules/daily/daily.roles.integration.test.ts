import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { dailyRoutes } from './daily.routes.js'
import { shareRoutes } from '../../routes/shares.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@daily-roles.int.test'

describe('daily module permissions (integration)', () => {
  let app: FastifyInstance
  let creator: { user: { id: string }; token: string }
  let editor: { user: { id: string; email: string }; token: string }
  let viewer: { user: { id: string; email: string }; token: string }
  let stranger: { user: { id: string; email: string }; token: string }
  let sessionId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: dailyRoutes, prefix: '/api/daily' },
      { plugin: shareRoutes, prefix: '/api/shares' },
    ])
    creator = await createTestUser(app, `creator${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    const session = await prisma.dailySession.create({
      data: { name: 'Roles daily', ownerId: creator.user.id, timePerPerson: 120 },
    })
    sessionId = session.id
    await prisma.moduleShare.createMany({
      data: [
        { module: 'daily', resourceId: sessionId, userId: editor.user.id, role: 'EDITOR' },
        { module: 'daily', resourceId: sessionId, userId: viewer.user.id, role: 'VIEWER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('exposes the effective role on session fetch', async () => {
    const cases: [string, string][] = [[creator.token, 'OWNER'], [editor.token, 'EDITOR'], [viewer.token, 'VIEWER']]
    for (const [token, role] of cases) {
      const res = await app.inject({ method: 'GET', url: `/api/daily/sessions/${sessionId}`, headers: { authorization: `Bearer ${token}` } })
      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe(role)
    }
  })

  it('hides the session from a stranger (404)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/daily/sessions/${sessionId}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(res.statusCode).toBe(404)
  })

  it('lists shared sessions with their role for the editor', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/daily/sessions', headers: { authorization: `Bearer ${editor.token}` } })
    expect(res.statusCode).toBe(200)
    const found = res.json().find((s: { id: string }) => s.id === sessionId)
    expect(found?.role).toBe('EDITOR')
  })

  it('only the owner can delete the session', async () => {
    const ko = await app.inject({ method: 'DELETE', url: `/api/daily/sessions/${sessionId}`, headers: { authorization: `Bearer ${editor.token}` } })
    expect(ko.statusCode).toBe(404)
  })

  it('share management: viewer cannot list, owner can invite (editor cannot)', async () => {
    const koViewer = await app.inject({ method: 'GET', url: `/api/shares/daily/${sessionId}`, headers: { authorization: `Bearer ${viewer.token}` } })
    expect(koViewer.statusCode).toBe(403)

    const koInvite = await app.inject({
      method: 'POST', url: `/api/shares/daily/${sessionId}/invite`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { email: stranger.user.email, role: 'VIEWER' },
    })
    expect(koInvite.statusCode).toBe(403)

    const okInvite = await app.inject({
      method: 'POST', url: `/api/shares/daily/${sessionId}/invite`,
      headers: { authorization: `Bearer ${creator.token}` },
      payload: { email: stranger.user.email, role: 'VIEWER' },
    })
    expect(okInvite.statusCode).toBe(201)
    const access = await app.inject({ method: 'GET', url: `/api/daily/sessions/${sessionId}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(access.statusCode).toBe(200)
    expect(access.json().role).toBe('VIEWER')
  })
})
