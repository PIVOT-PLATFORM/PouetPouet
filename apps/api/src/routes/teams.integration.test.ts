import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../test/build-app.js'
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
