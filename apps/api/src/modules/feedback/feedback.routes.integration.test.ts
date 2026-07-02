import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { feedbackRoutes } from './feedback.routes.js'

// L'email admin doit correspondre à ADMIN_EMAILS (vitest.integration.config.ts).
const SUFFIX = '@feedback.int.test'
const ADMIN_EMAIL = `admin${SUFFIX}`

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('Feedback — création & liste', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let ticketId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: feedbackRoutes, prefix: '/api/feedback' }])
    alice = await createTestUser(app, `alice${SUFFIX}`)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('POST / authentifié → 201, authorId renseigné, hasVoted false', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/feedback', headers: auth(alice.token), payload: { title: 'Bug login', body: 'ça plante', type: 'BUG', authorName: 'Alice' } })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    ticketId = body.id
    expect(body.authorId).toBe(alice.user.id)
    expect(body.hasVoted).toBe(false)
    expect(body.votes).toBe(0)
  })

  it('POST / anonyme (sans token) → 201, authorId null', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/feedback', payload: { title: 'Idée', body: 'un truc', type: 'FEATURE', authorName: 'Anon' } })
    expect(res.statusCode).toBe(201)
    expect(res.json().authorId).toBeNull()
  })

  it('GET / liste les tickets (ordre desc de création)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/feedback' })
    expect(res.statusCode).toBe(200)
    const list = res.json()
    expect(list.length).toBeGreaterThanOrEqual(2)
    expect(list.some((t: { id: string }) => t.id === ticketId)).toBe(true)
  })

  it('POST / body invalide (titre vide) → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/feedback', headers: auth(alice.token), payload: { title: '', body: 'x', authorName: 'Alice' } })
    expect(res.statusCode).toBe(400)
  })
})

describe('Feedback — édition & permissions admin', () => {
  let app: FastifyInstance
  let admin: { user: { id: string }; token: string }
  let alice: { user: { id: string }; token: string }
  let bob: { user: { id: string }; token: string }
  let ticketId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: feedbackRoutes, prefix: '/api/feedback' }])
    admin = await createTestUser(app, ADMIN_EMAIL)
    alice = await createTestUser(app, `alice-edit${SUFFIX}`)
    bob = await createTestUser(app, `bob-edit${SUFFIX}`)
    const created = await app.inject({ method: 'POST', url: '/api/feedback', headers: auth(alice.token), payload: { title: 'Titre initial', body: 'corps', authorName: 'Alice' } })
    ticketId = created.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('PATCH /:id — l\'auteur peut éditer son ticket', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/feedback/${ticketId}`, headers: auth(alice.token), payload: { title: 'Titre édité' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Titre édité')
  })

  it('PATCH /:id — un tiers non-admin ne peut pas éditer → 403', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/feedback/${ticketId}`, headers: auth(bob.token), payload: { title: 'pirate' } })
    expect(res.statusCode).toBe(403)
  })

  it('PATCH /:id — un admin peut éditer n\'importe quel ticket', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/feedback/${ticketId}`, headers: auth(admin.token), payload: { title: 'Titre admin' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Titre admin')
  })

  it('PATCH /:id/column — non-admin → 403', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/feedback/${ticketId}/column`, headers: auth(alice.token), payload: { column: 'DONE' } })
    expect(res.statusCode).toBe(403)
  })

  it('PATCH /:id/column — admin déplace la carte', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/feedback/${ticketId}/column`, headers: auth(admin.token), payload: { column: 'IMPLEMENTING' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().column).toBe('IMPLEMENTING')
  })

  it('DELETE /:id — non-admin → 403 ; admin → 204', async () => {
    const denied = await app.inject({ method: 'DELETE', url: `/api/feedback/${ticketId}`, headers: auth(bob.token) })
    expect(denied.statusCode).toBe(403)
    const ok = await app.inject({ method: 'DELETE', url: `/api/feedback/${ticketId}`, headers: auth(admin.token) })
    expect(ok.statusCode).toBe(204)
  })

  it('DELETE /:id — ticket inexistant → 404', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/feedback/ckinexistant000000000000', headers: auth(admin.token) })
    expect(res.statusCode).toBe(404)
  })
})

describe('Feedback — votes (toggle + hasVoted par utilisateur)', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let bob: { user: { id: string }; token: string }
  let ticketId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: feedbackRoutes, prefix: '/api/feedback' }])
    alice = await createTestUser(app, `alice-vote${SUFFIX}`)
    bob = await createTestUser(app, `bob-vote${SUFFIX}`)
    const created = await app.inject({ method: 'POST', url: '/api/feedback', headers: auth(alice.token), payload: { title: 'Votable', body: 'corps', authorName: 'Alice' } })
    ticketId = created.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('premier vote → hasVoted true, votes = 1', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/feedback/${ticketId}/vote`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ hasVoted: true, votes: 1 })
  })

  it('re-vote du même utilisateur → toggle off, votes = 0', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/feedback/${ticketId}/vote`, headers: auth(alice.token) })
    expect(res.json()).toEqual({ hasVoted: false, votes: 0 })
  })

  it('deux utilisateurs votent → votes = 2', async () => {
    await app.inject({ method: 'POST', url: `/api/feedback/${ticketId}/vote`, headers: auth(alice.token) })
    const res = await app.inject({ method: 'POST', url: `/api/feedback/${ticketId}/vote`, headers: auth(bob.token) })
    expect(res.json().votes).toBe(2)
  })

  it('GET / — hasVoted est propre à chaque utilisateur', async () => {
    const carol = await createTestUser(app, `carol-vote${SUFFIX}`)
    const asAlice = await app.inject({ method: 'GET', url: '/api/feedback', headers: auth(alice.token) })
    const asCarol = await app.inject({ method: 'GET', url: '/api/feedback', headers: auth(carol.token) })
    const aliceTicket = asAlice.json().find((t: { id: string }) => t.id === ticketId)
    const carolTicket = asCarol.json().find((t: { id: string }) => t.id === ticketId)
    expect(aliceTicket.hasVoted).toBe(true)
    expect(carolTicket.hasVoted).toBe(false)
    expect(aliceTicket.votes).toBe(2)
  })

  it('vote sur un ticket inexistant → 404', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/feedback/ckinexistant000000000000/vote', headers: auth(alice.token) })
    expect(res.statusCode).toBe(404)
  })
})
