import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { scrumRoutes } from './scrum.routes.js'
import { shareRoutes } from '../../routes/shares.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@scrum-roles.int.test'

describe('scrum module permissions (integration)', () => {
  let app: FastifyInstance
  let creator: { user: { id: string }; token: string }
  let editor: { user: { id: string; email: string }; token: string }
  let viewer: { user: { id: string; email: string }; token: string }
  let stranger: { user: { id: string; email: string }; token: string }
  let roomId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: scrumRoutes, prefix: '/api/scrum' },
      { plugin: shareRoutes, prefix: '/api/shares' },
    ])
    creator = await createTestUser(app, `creator${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    const room = await prisma.scrumRoom.create({
      data: { name: 'Roles room', code: `RL${Date.now().toString(36).toUpperCase()}`, ownerId: creator.user.id, scale: 'FIBONACCI' },
    })
    roomId = room.id
    await prisma.moduleShare.createMany({
      data: [
        { module: 'scrum', resourceId: roomId, userId: editor.user.id, role: 'EDITOR' },
        { module: 'scrum', resourceId: roomId, userId: viewer.user.id, role: 'VIEWER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('exposes the effective role on room fetch (owner/editor/viewer)', async () => {
    const cases: [string, string][] = [[creator.token, 'OWNER'], [editor.token, 'EDITOR'], [viewer.token, 'VIEWER']]
    for (const [token, role] of cases) {
      const res = await app.inject({ method: 'GET', url: `/api/scrum/${roomId}`, headers: { authorization: `Bearer ${token}` } })
      expect(res.statusCode).toBe(200)
      expect(res.json().role).toBe(role)
    }
  })

  it('hides the room from a stranger (404)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/scrum/${roomId}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(res.statusCode).toBe(404)
  })

  it('lists shared rooms with their role for the editor', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/scrum', headers: { authorization: `Bearer ${editor.token}` } })
    expect(res.statusCode).toBe(200)
    const room = res.json().find((r: { id: string }) => r.id === roomId)
    expect(room?.role).toBe('EDITOR')
  })

  it('only the owner can delete the room', async () => {
    const ko = await app.inject({ method: 'DELETE', url: `/api/scrum/${roomId}`, headers: { authorization: `Bearer ${editor.token}` } })
    expect(ko.statusCode).toBe(404)
  })

  it('share management: owner/editor can list, viewer cannot', async () => {
    const okOwner = await app.inject({ method: 'GET', url: `/api/shares/scrum/${roomId}`, headers: { authorization: `Bearer ${creator.token}` } })
    expect(okOwner.statusCode).toBe(200)
    const okEditor = await app.inject({ method: 'GET', url: `/api/shares/scrum/${roomId}`, headers: { authorization: `Bearer ${editor.token}` } })
    expect(okEditor.statusCode).toBe(200)
    const koViewer = await app.inject({ method: 'GET', url: `/api/shares/scrum/${roomId}`, headers: { authorization: `Bearer ${viewer.token}` } })
    expect(koViewer.statusCode).toBe(403)
  })

  it('only the owner can invite; an editor cannot', async () => {
    const ko = await app.inject({
      method: 'POST', url: `/api/shares/scrum/${roomId}/invite`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { email: stranger.user.email, role: 'EDITOR' },
    })
    expect(ko.statusCode).toBe(403)

    const ok = await app.inject({
      method: 'POST', url: `/api/shares/scrum/${roomId}/invite`,
      headers: { authorization: `Bearer ${creator.token}` },
      payload: { email: stranger.user.email, role: 'EDITOR' },
    })
    expect(ok.statusCode).toBe(201)
    // l'ex-étranger a désormais accès
    const access = await app.inject({ method: 'GET', url: `/api/scrum/${roomId}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(access.statusCode).toBe(200)
    expect(access.json().role).toBe('EDITOR')
  })

  it('deleting a room cleans up its shares', async () => {
    const room = await prisma.scrumRoom.create({
      data: { name: 'Temp', code: `TMP${Date.now().toString(36).toUpperCase()}`, ownerId: creator.user.id, scale: 'FIBONACCI' },
    })
    await prisma.moduleShare.create({ data: { module: 'scrum', resourceId: room.id, userId: editor.user.id, role: 'EDITOR' } })
    const res = await app.inject({ method: 'DELETE', url: `/api/scrum/${room.id}`, headers: { authorization: `Bearer ${creator.token}` } })
    expect(res.statusCode).toBe(204)
    const remaining = await prisma.moduleShare.count({ where: { module: 'scrum', resourceId: room.id } })
    expect(remaining).toBe(0)
  })
})
