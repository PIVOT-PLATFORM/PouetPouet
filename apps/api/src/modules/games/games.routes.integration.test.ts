import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { gamesRoutes } from './games.routes.js'

const SUFFIX = '@games.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('Games — score & leaderboard', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let bob: { user: { id: string }; token: string }

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: gamesRoutes, prefix: '/api/games' }])
    alice = await createTestUser(app, `alice${SUFFIX}`)
    bob = await createTestUser(app, `bob${SUFFIX}`)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('POST /score sans token → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/games/score', payload: { game: 'trivia', score: 10 } })
    expect(res.statusCode).toBe(401)
  })

  it('POST /score jeu inconnu → 400 (validation Zod)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/games/score', headers: auth(alice.token), payload: { game: 'not-a-game', score: 10 } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /score score négatif → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/games/score', headers: auth(alice.token), payload: { game: 'trivia', score: -1 } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /score valide → 201, entrée créée', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/games/score', headers: auth(alice.token), payload: { game: 'trivia', score: 42, metadata: { streak: 3 } } })
    expect(res.statusCode).toBe(201)
    expect(res.json().score).toBe(42)
  })

  it('GET /scores/:game jeu inconnu → 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/games/scores/not-a-game', headers: auth(alice.token) })
    expect(res.statusCode).toBe(404)
  })

  it('GET /scores/:game — classement trié desc, isMe correct, myBest renseigné', async () => {
    await app.inject({ method: 'POST', url: '/api/games/score', headers: auth(alice.token), payload: { game: 'bingo', score: 5 } })
    await app.inject({ method: 'POST', url: '/api/games/score', headers: auth(bob.token), payload: { game: 'bingo', score: 99 } })

    const res = await app.inject({ method: 'GET', url: '/api/games/scores/bingo', headers: auth(alice.token) })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.scores[0].score).toBe(99)
    expect(body.scores[0].isMe).toBe(false)
    expect(body.scores.some((s: { userId: string; isMe: boolean }) => s.userId === alice.user.id && s.isMe)).toBe(true)
    expect(body.myBest).toBe(5)
  })

  it('GET /scores/:game — myBest null si l\'utilisateur n\'a jamais joué', async () => {
    const carol = await createTestUser(app, `carol${SUFFIX}`)
    const res = await app.inject({ method: 'GET', url: '/api/games/scores/bingo', headers: auth(carol.token) })
    expect(res.json().myBest).toBeNull()
  })
})
