import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { wheelRoutes } from './wheel.routes.js'
import { shareRoutes } from '../../routes/shares.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@wheel-roles.int.test'

describe('wheel module permissions (integration)', () => {
  let app: FastifyInstance
  let creator: { user: { id: string }; token: string }
  let editor: { user: { id: string; email: string }; token: string }
  let viewer: { user: { id: string; email: string }; token: string }
  let stranger: { user: { id: string; email: string }; token: string }
  let eventId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: wheelRoutes, prefix: '/api/wheel' },
      { plugin: shareRoutes, prefix: '/api/shares' },
    ])
    creator = await createTestUser(app, `creator${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    const event = await prisma.wheelEvent.create({
      data: { name: 'Roles event', ownerId: creator.user.id },
    })
    eventId = event.id
    await prisma.moduleShare.createMany({
      data: [
        { module: 'wheel', resourceId: eventId, userId: editor.user.id, role: 'EDITOR' },
        { module: 'wheel', resourceId: eventId, userId: viewer.user.id, role: 'VIEWER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('lists shared events with their role for the editor', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/wheel/events', headers: { authorization: `Bearer ${editor.token}` } })
    expect(res.statusCode).toBe(200)
    const found = res.json().find((e: { id: string }) => e.id === eventId)
    expect(found?.role).toBe('EDITOR')
  })

  it('lists shared events with their role for the viewer', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/wheel/events', headers: { authorization: `Bearer ${viewer.token}` } })
    expect(res.statusCode).toBe(200)
    const found = res.json().find((e: { id: string }) => e.id === eventId)
    expect(found?.role).toBe('VIEWER')
  })

  it('hides the event from a stranger', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/wheel/events', headers: { authorization: `Bearer ${stranger.token}` } })
    expect(res.statusCode).toBe(200)
    const found = res.json().find((e: { id: string }) => e.id === eventId)
    expect(found).toBeUndefined()
  })

  it('editor can rename, viewer cannot', async () => {
    const ok = await app.inject({
      method: 'PATCH', url: `/api/wheel/events/${eventId}`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { name: 'Renamed by editor' },
    })
    expect(ok.statusCode).toBe(200)

    const ko = await app.inject({
      method: 'PATCH', url: `/api/wheel/events/${eventId}`,
      headers: { authorization: `Bearer ${viewer.token}` },
      payload: { name: 'Should fail' },
    })
    expect(ko.statusCode).toBe(404)
  })

  it('only the owner can delete the event', async () => {
    const ko = await app.inject({ method: 'DELETE', url: `/api/wheel/events/${eventId}`, headers: { authorization: `Bearer ${editor.token}` } })
    expect(ko.statusCode).toBe(404)
  })

  it('share management: owner can invite; editor cannot', async () => {
    const ko = await app.inject({
      method: 'POST', url: `/api/shares/wheel/${eventId}/invite`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { email: stranger.user.email, role: 'VIEWER' },
    })
    expect(ko.statusCode).toBe(403)

    const ok = await app.inject({
      method: 'POST', url: `/api/shares/wheel/${eventId}/invite`,
      headers: { authorization: `Bearer ${creator.token}` },
      payload: { email: stranger.user.email, role: 'VIEWER' },
    })
    expect(ok.statusCode).toBe(201)
  })

  it('deleting an event cleans up its shares', async () => {
    const event = await prisma.wheelEvent.create({ data: { name: 'Temp', ownerId: creator.user.id } })
    await prisma.moduleShare.create({ data: { module: 'wheel', resourceId: event.id, userId: editor.user.id, role: 'EDITOR' } })
    const res = await app.inject({ method: 'DELETE', url: `/api/wheel/events/${event.id}`, headers: { authorization: `Bearer ${creator.token}` } })
    expect(res.statusCode).toBe(204)
    const remaining = await prisma.moduleShare.count({ where: { module: 'wheel', resourceId: event.id } })
    expect(remaining).toBe(0)
  })
})
