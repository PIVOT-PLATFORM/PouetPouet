import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { capacityRoutes } from './capacity.routes.js'
import { shareRoutes } from '../../routes/shares.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@capacity-roles.int.test'

describe('capacity module permissions (integration)', () => {
  let app: FastifyInstance
  let creator: { user: { id: string }; token: string }
  let editor: { user: { id: string; email: string }; token: string }
  let viewer: { user: { id: string; email: string }; token: string }
  let stranger: { user: { id: string; email: string }; token: string }
  let eventId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: capacityRoutes, prefix: '/api/capacity' },
      { plugin: shareRoutes, prefix: '/api/shares' },
    ])
    creator = await createTestUser(app, `creator${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    const event = await prisma.capacityEvent.create({
      data: {
        name: 'Roles capacity event',
        ownerId: creator.user.id,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      },
    })
    eventId = event.id
    await prisma.moduleShare.createMany({
      data: [
        { module: 'capacity', resourceId: eventId, userId: editor.user.id, role: 'EDITOR' },
        { module: 'capacity', resourceId: eventId, userId: viewer.user.id, role: 'VIEWER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('exposes the effective role on event fetch', async () => {
    const cases: [string, string][] = [
      [creator.token, 'OWNER'],
      [editor.token, 'EDITOR'],
      [viewer.token, 'VIEWER'],
    ]
    for (const [token, role] of cases) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/capacity/events/${eventId}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe(role)
    }
  })

  it('hides the event from a stranger (404)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/capacity/events/${eventId}`,
      headers: { authorization: `Bearer ${stranger.token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('lists shared events with their role for editor', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/capacity/events',
      headers: { authorization: `Bearer ${editor.token}` },
    })
    expect(res.statusCode).toBe(200)
    const found = res.json().find((e: { id: string }) => e.id === eventId)
    expect(found?.role).toBe('EDITOR')
  })

  it('editor can update the event, viewer cannot', async () => {
    const okEdit = await app.inject({
      method: 'PUT',
      url: `/api/capacity/events/${eventId}`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { name: 'Updated by editor' },
    })
    expect(okEdit.statusCode).toBe(200)

    const koView = await app.inject({
      method: 'PUT',
      url: `/api/capacity/events/${eventId}`,
      headers: { authorization: `Bearer ${viewer.token}` },
      payload: { name: 'Viewer edit attempt' },
    })
    expect(koView.statusCode).toBe(404)
  })

  it('only the owner can delete the event', async () => {
    const disposable = await prisma.capacityEvent.create({
      data: {
        name: 'Disposable',
        ownerId: creator.user.id,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
      },
    })
    const koEditor = await app.inject({
      method: 'DELETE',
      url: `/api/capacity/events/${disposable.id}`,
      headers: { authorization: `Bearer ${editor.token}` },
    })
    expect(koEditor.statusCode).toBe(404)
    const ok = await app.inject({
      method: 'DELETE',
      url: `/api/capacity/events/${disposable.id}`,
      headers: { authorization: `Bearer ${creator.token}` },
    })
    expect(ok.statusCode).toBe(204)
  })

  it('share management: viewer cannot list, editor cannot invite, owner can invite', async () => {
    const koViewer = await app.inject({
      method: 'GET',
      url: `/api/shares/capacity/${eventId}`,
      headers: { authorization: `Bearer ${viewer.token}` },
    })
    expect(koViewer.statusCode).toBe(403)

    const koInvite = await app.inject({
      method: 'POST',
      url: `/api/shares/capacity/${eventId}/invite`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { email: stranger.user.email, role: 'VIEWER' },
    })
    expect(koInvite.statusCode).toBe(403)

    const okInvite = await app.inject({
      method: 'POST',
      url: `/api/shares/capacity/${eventId}/invite`,
      headers: { authorization: `Bearer ${creator.token}` },
      payload: { email: stranger.user.email, role: 'VIEWER' },
    })
    expect(okInvite.statusCode).toBe(201)

    const access = await app.inject({
      method: 'GET',
      url: `/api/capacity/events/${eventId}`,
      headers: { authorization: `Bearer ${stranger.token}` },
    })
    expect(access.statusCode).toBe(200)
    expect(access.json().role).toBe('VIEWER')
  })
})
