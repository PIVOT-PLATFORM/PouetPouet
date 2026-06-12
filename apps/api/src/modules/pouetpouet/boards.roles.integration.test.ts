import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { boardRoutes } from './boards.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@roles.int.test'

// Matrice des rôles : créateur / co-propriétaire (share OWNER) / éditeur / lecteur.
describe('board roles matrix (integration)', () => {
  let app: FastifyInstance
  let creator: { user: { id: string }; token: string }
  let coOwner: { user: { id: string; email: string }; token: string }
  let editor: { user: { id: string; email: string }; token: string }
  let viewer: { user: { id: string; email: string }; token: string }
  let boardId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: boardRoutes, prefix: '/api/boards' }])
    creator = await createTestUser(app, `creator${SUFFIX}`)
    coOwner = await createTestUser(app, `coowner${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)

    const board = await prisma.board.create({ data: { name: 'Roles board', ownerId: creator.user.id } })
    boardId = board.id
    await prisma.boardShare.createMany({
      data: [
        { boardId, userId: coOwner.user.id, role: 'OWNER' },
        { boardId, userId: editor.user.id, role: 'EDITOR' },
        { boardId, userId: viewer.user.id, role: 'VIEWER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('returns role OWNER for the co-owner on board fetch', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/boards/${boardId}`,
      headers: { authorization: `Bearer ${coOwner.token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().role).toBe('OWNER')
  })

  it('lets a co-owner rename the board, not an editor', async () => {
    const ok = await app.inject({
      method: 'PATCH',
      url: `/api/boards/${boardId}`,
      headers: { authorization: `Bearer ${coOwner.token}` },
      payload: { name: 'Renommé par co-owner' },
    })
    expect(ok.statusCode).toBe(200)

    const ko = await app.inject({
      method: 'PATCH',
      url: `/api/boards/${boardId}`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { name: 'Tentative éditeur' },
    })
    expect(ko.statusCode).toBe(403)
  })

  it('lets a co-owner invite someone as OWNER', async () => {
    const invitee = await createTestUser(app, `invitee${SUFFIX}`)
    const res = await app.inject({
      method: 'POST',
      url: `/api/boards/${boardId}/shares/invite`,
      headers: { authorization: `Bearer ${coOwner.token}` },
      payload: { email: invitee.user.email, role: 'OWNER' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().role).toBe('OWNER')
  })

  it('refuses OWNER as a share-link role', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/boards/${boardId}/shares/link`,
      headers: { authorization: `Bearer ${creator.token}` },
      payload: { role: 'OWNER' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('blocks viewers and editors from managing shares', async () => {
    for (const token of [editor.token, viewer.token]) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/boards/${boardId}/shares`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
    }
  })

  it('lets a co-owner delete the board', async () => {
    const board = await prisma.board.create({ data: { name: 'À supprimer', ownerId: creator.user.id } })
    await prisma.boardShare.create({ data: { boardId: board.id, userId: coOwner.user.id, role: 'OWNER' } })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/boards/${board.id}`,
      headers: { authorization: `Bearer ${coOwner.token}` },
    })
    expect(res.statusCode).toBe(204)
  })
})
