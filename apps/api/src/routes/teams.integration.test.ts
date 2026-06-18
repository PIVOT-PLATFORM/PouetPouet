import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../test/build-app.js'
import { prisma } from '../lib/prisma.js'
import { teamRoutes } from './teams.js'

const SUFFIX = '@teams.int.test'

describe('/api/teams (integration)', () => {
  let app: FastifyInstance
  let token: string
  let otherToken: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: teamRoutes, prefix: '/api/teams' }])
    token = (await createTestUser(app, `owner${SUFFIX}`)).token
    otherToken = (await createTestUser(app, `other${SUFFIX}`)).token
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/teams' })
    expect(res.statusCode).toBe(401)
  })

  it('creates a team with string[] members (Daily style)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Équipe A', members: ['Alice', 'Bob'] },
    })
    expect(res.statusCode).toBe(201)
    const team = res.json()
    expect(team.members).toHaveLength(2)
    expect(team.members[0]).toMatchObject({ name: 'Alice', order: 0 })
    expect(team._count).toMatchObject({ dailySessions: 0, wheelDraws: 0, scrumRooms: 0, capacityEvents: 0 })
  })

  it('creates a team with MemberInput[] members (Capacity style)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Équipe B', members: [{ name: 'Carol', role: 'Dev', fte: 0.8 }] },
    })
    expect(res.statusCode).toBe(201)
    const team = res.json()
    expect(team.members[0]).toMatchObject({ name: 'Carol', role: 'Dev', fte: 0.8 })
  })

  it('rejects creation without a name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '   ' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('lists only the caller teams', async () => {
    const mine = await app.inject({ method: 'GET', url: '/api/teams', headers: { authorization: `Bearer ${token}` } })
    const theirs = await app.inject({ method: 'GET', url: '/api/teams', headers: { authorization: `Bearer ${otherToken}` } })
    expect(mine.json().length).toBeGreaterThanOrEqual(2)
    expect(theirs.json()).toHaveLength(0)
  })

  it('updates a team and replaces its members', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Équipe C', members: ['Old'] },
    })
    const id = created.json().id
    const res = await app.inject({
      method: 'PUT',
      url: `/api/teams/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Équipe C v2', members: ['New1', 'New2'] },
    })
    expect(res.statusCode).toBe(200)
    const team = res.json()
    expect(team.name).toBe('Équipe C v2')
    expect(team.members.map((m: { name: string }) => m.name)).toEqual(['New1', 'New2'])
  })

  it('blocks update and delete of another user team', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Privée' },
    })
    const id = created.json().id
    const upd = await app.inject({
      method: 'PUT',
      url: `/api/teams/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
      payload: { name: 'Volée' },
    })
    expect(upd.statusCode).toBe(404)
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/teams/${id}`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(del.statusCode).toBe(404)
  })

  it('deletes a team', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'À supprimer' },
    })
    const id = created.json().id
    const del = await app.inject({
      method: 'DELETE',
      url: `/api/teams/${id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(del.statusCode).toBe(204)
    const list = await app.inject({ method: 'GET', url: '/api/teams', headers: { authorization: `Bearer ${token}` } })
    expect(list.json().find((t: { id: string }) => t.id === id)).toBeUndefined()
  })
})

// #134 — partage d'équipe via ModuleShare(module='team').
const SHARE_SUFFIX = '@teams.share.int.test'

describe('/api/teams partage (integration)', () => {
  let app: FastifyInstance
  let ownerTok: string, editorTok: string, viewerTok: string, strangerTok: string
  let editorId: string, viewerId: string
  let teamId: string

  beforeAll(async () => {
    await cleanupUsers(SHARE_SUFFIX)
    app = await buildTestApp([{ plugin: teamRoutes, prefix: '/api/teams' }])
    ownerTok = (await createTestUser(app, `owner${SHARE_SUFFIX}`)).token
    const editor = await createTestUser(app, `editor${SHARE_SUFFIX}`)
    const viewer = await createTestUser(app, `viewer${SHARE_SUFFIX}`)
    editorTok = editor.token; editorId = editor.user.id
    viewerTok = viewer.token; viewerId = viewer.user.id
    strangerTok = (await createTestUser(app, `stranger${SHARE_SUFFIX}`)).token

    const created = await app.inject({
      method: 'POST', url: '/api/teams',
      headers: { authorization: `Bearer ${ownerTok}` },
      payload: { name: 'Équipe partagée', members: ['Alice'] },
    })
    teamId = created.json().id
    await prisma.moduleShare.createMany({
      data: [
        { module: 'team', resourceId: teamId, userId: editorId, role: 'EDITOR' },
        { module: 'team', resourceId: teamId, userId: viewerId, role: 'VIEWER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsers(SHARE_SUFFIX)
    await app.close()
  })

  it('lists the team for shared users with the right role, hides it from a stranger', async () => {
    const find = async (tok: string) => {
      const res = await app.inject({ method: 'GET', url: '/api/teams', headers: { authorization: `Bearer ${tok}` } })
      return res.json().find((t: { id: string }) => t.id === teamId)
    }
    expect((await find(ownerTok))?.role).toBe('OWNER')
    expect((await find(editorTok))?.role).toBe('EDITOR')
    expect((await find(viewerTok))?.role).toBe('VIEWER')
    expect(await find(strangerTok)).toBeUndefined()
  })

  it('lets an EDITOR update the roster but blocks VIEWER (403) and stranger (404)', async () => {
    const put = (tok: string) => app.inject({
      method: 'PUT', url: `/api/teams/${teamId}`,
      headers: { authorization: `Bearer ${tok}` },
      payload: { name: 'Équipe partagée', members: ['Alice', 'Bob'] },
    })
    expect((await put(editorTok)).statusCode).toBe(200)
    expect((await put(viewerTok)).statusCode).toBe(403)
    expect((await put(strangerTok)).statusCode).toBe(404)
  })

  it('keeps delete owner-only and cleans up shares on delete', async () => {
    expect((await app.inject({ method: 'DELETE', url: `/api/teams/${teamId}`, headers: { authorization: `Bearer ${editorTok}` } })).statusCode).toBe(404)
    expect((await app.inject({ method: 'DELETE', url: `/api/teams/${teamId}`, headers: { authorization: `Bearer ${ownerTok}` } })).statusCode).toBe(204)
    const remaining = await prisma.moduleShare.count({ where: { module: 'team', resourceId: teamId } })
    expect(remaining).toBe(0)
  })
})
