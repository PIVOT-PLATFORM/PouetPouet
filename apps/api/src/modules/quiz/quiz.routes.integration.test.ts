import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { quizRoutes } from './quiz.routes.js'

// Le gameplay temps réel (quiz.sockets.ts) suit la convention du repo : couvert
// par l'E2E Playwright, pas par des tests d'intégration socket.io (comme tous
// les autres modules à sockets — scrum, daily, board, feedback).
const SUFFIX = '@quiz.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('Quiz — CRUD, questions, sessions', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let bob: { user: { id: string }; token: string }
  let quizId: string
  let questionId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: quizRoutes, prefix: '/api/quiz' }])
    alice = await createTestUser(app, `alice${SUFFIX}`)
    bob = await createTestUser(app, `bob${SUFFIX}`)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('POST / sans titre → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/quiz', headers: auth(alice.token), payload: { title: '  ' } })
    expect(res.statusCode).toBe(400)
  })

  it('POST / crée un quiz appartenant à l\'auteur', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/quiz', headers: auth(alice.token), payload: { title: 'Culture générale' } })
    expect(res.statusCode).toBe(201)
    quizId = res.json().id
    expect(res.json().ownerId).toBe(alice.user.id)
  })

  it('GET / ne liste que les quiz de l\'utilisateur courant', async () => {
    const asAlice = await app.inject({ method: 'GET', url: '/api/quiz', headers: auth(alice.token) })
    const asBob = await app.inject({ method: 'GET', url: '/api/quiz', headers: auth(bob.token) })
    expect(asAlice.json().some((q: { id: string }) => q.id === quizId)).toBe(true)
    expect(asBob.json().some((q: { id: string }) => q.id === quizId)).toBe(false)
  })

  it('GET /:id — un tiers ne peut pas voir le quiz d\'un autre → 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/quiz/${quizId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /:id — un tiers ne peut pas renommer → 404', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/quiz/${quizId}`, headers: auth(bob.token), payload: { title: 'pirate' } })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /:id — le propriétaire renomme', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/quiz/${quizId}`, headers: auth(alice.token), payload: { title: 'Culture G. v2' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Culture G. v2')
  })

  it('PATCH /:id/favorite — toggle', async () => {
    const on = await app.inject({ method: 'PATCH', url: `/api/quiz/${quizId}/favorite`, headers: auth(alice.token) })
    expect(on.json().isFavorite).toBe(true)
    const off = await app.inject({ method: 'PATCH', url: `/api/quiz/${quizId}/favorite`, headers: auth(alice.token) })
    expect(off.json().isFavorite).toBe(false)
  })

  it('POST /:id/questions — options insuffisantes → 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/quiz/${quizId}/questions`, headers: auth(alice.token), payload: { text: 'Q1', options: ['A'], correct: 0 } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /:id/questions — index correct hors bornes → 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/quiz/${quizId}/questions`, headers: auth(alice.token), payload: { text: 'Q1', options: ['A', 'B'], correct: 5 } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /:id/questions — un tiers ne peut pas ajouter de question → 404', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/quiz/${quizId}/questions`, headers: auth(bob.token), payload: { text: 'Q pirate', options: ['A', 'B'], correct: 0 } })
    expect(res.statusCode).toBe(404)
  })

  it('POST /:id/questions — crée une question avec les valeurs par défaut', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/quiz/${quizId}/questions`, headers: auth(alice.token), payload: { text: 'Capitale de la France ?', options: ['Paris', 'Lyon'], correct: 0 } })
    expect(res.statusCode).toBe(201)
    questionId = res.json().id
    expect(res.json().timeLimit).toBe(30)
    expect(res.json().points).toBe(1000)
    expect(res.json().order).toBe(0)
  })

  it('GET /:id/questions — un tiers ne peut pas lister → 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/quiz/${quizId}/questions`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /questions/:qId — un tiers ne peut pas éditer → 404', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/quiz/questions/${questionId}`, headers: auth(bob.token), payload: { text: 'pirate' } })
    expect(res.statusCode).toBe(404)
  })

  it('PUT /questions/:qId — le propriétaire édite partiellement', async () => {
    const res = await app.inject({ method: 'PUT', url: `/api/quiz/questions/${questionId}`, headers: auth(alice.token), payload: { points: 500 } })
    expect(res.statusCode).toBe(200)
    expect(res.json().points).toBe(500)
    expect(res.json().text).toBe('Capitale de la France ?')
  })

  it('PATCH /:id/questions/bulk — rien à mettre à jour → 400', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/quiz/${quizId}/questions/bulk`, headers: auth(alice.token), payload: {} })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH /:id/questions/bulk — applique timeLimit à toutes les questions', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/quiz/${quizId}/questions/bulk`, headers: auth(alice.token), payload: { timeLimit: 45 } })
    expect(res.statusCode).toBe(200)
    expect(res.json().every((q: { timeLimit: number }) => q.timeLimit === 45)).toBe(true)
  })

  it('POST /:id/reorder — réordonne les questions', async () => {
    const second = await app.inject({ method: 'POST', url: `/api/quiz/${quizId}/questions`, headers: auth(alice.token), payload: { text: 'Q2', options: ['A', 'B'], correct: 1 } })
    const secondId = second.json().id
    const res = await app.inject({ method: 'POST', url: `/api/quiz/${quizId}/reorder`, headers: auth(alice.token), payload: { order: [secondId, questionId] } })
    expect(res.statusCode).toBe(204)
    const list = await app.inject({ method: 'GET', url: `/api/quiz/${quizId}/questions`, headers: auth(alice.token) })
    expect(list.json()[0].id).toBe(secondId)
  })

  it('DELETE /questions/:qId — un tiers ne peut pas supprimer → 404 ; le propriétaire → 204', async () => {
    const denied = await app.inject({ method: 'DELETE', url: `/api/quiz/questions/${questionId}`, headers: auth(bob.token) })
    expect(denied.statusCode).toBe(404)
    const ok = await app.inject({ method: 'DELETE', url: `/api/quiz/questions/${questionId}`, headers: auth(alice.token) })
    expect(ok.statusCode).toBe(204)
  })

  describe('Sessions', () => {
    let sessionId: string
    let code: string

    it('POST /:id/session — un tiers ne peut pas créer de session → 404', async () => {
      const res = await app.inject({ method: 'POST', url: `/api/quiz/${quizId}/session`, headers: auth(bob.token) })
      expect(res.statusCode).toBe(404)
    })

    it('POST /:id/session — crée une session avec un code à 6 caractères', async () => {
      const res = await app.inject({ method: 'POST', url: `/api/quiz/${quizId}/session`, headers: auth(alice.token), payload: { title: 'Session live' } })
      expect(res.statusCode).toBe(201)
      sessionId = res.json().sessionId
      code = res.json().code
      expect(code).toHaveLength(6)
    })

    it('GET /session/:code — accessible sans authentification (rejoint public)', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/quiz/session/${code}` })
      expect(res.statusCode).toBe(200)
      expect(res.json().quizTitle).toBe('Culture G. v2')
      expect(res.json().status).toBe('LOBBY')
    })

    it('GET /session/:code — insensible à la casse', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/quiz/session/${code.toLowerCase()}` })
      expect(res.statusCode).toBe(200)
    })

    it('GET /session/:code — code inconnu → 404', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/quiz/session/ZZZZZZ' })
      expect(res.statusCode).toBe(404)
    })

    it('PATCH /session/:sessionId — un tiers ne peut pas renommer → 404', async () => {
      const res = await app.inject({ method: 'PATCH', url: `/api/quiz/session/${sessionId}`, headers: auth(bob.token), payload: { title: 'pirate' } })
      expect(res.statusCode).toBe(404)
    })

    it('PATCH /session/:sessionId — le propriétaire renomme', async () => {
      const res = await app.inject({ method: 'PATCH', url: `/api/quiz/session/${sessionId}`, headers: auth(alice.token), payload: { title: 'Nouveau nom' } })
      expect(res.statusCode).toBe(204)
    })

    it('GET /:id/sessions — un tiers ne peut pas voir l\'historique → 404', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/quiz/${quizId}/sessions`, headers: auth(bob.token) })
      expect(res.statusCode).toBe(404)
    })

    it('GET /:id/sessions — ne renvoie que les sessions terminées (LOBBY exclu)', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/quiz/${quizId}/sessions`, headers: auth(alice.token) })
      expect(res.statusCode).toBe(200)
      expect(res.json().some((s: { id: string }) => s.id === sessionId)).toBe(false)
    })
  })

  it('DELETE /:id — un tiers ne peut pas supprimer → 404 ; le propriétaire → 204', async () => {
    const denied = await app.inject({ method: 'DELETE', url: `/api/quiz/${quizId}`, headers: auth(bob.token) })
    expect(denied.statusCode).toBe(404)
    const ok = await app.inject({ method: 'DELETE', url: `/api/quiz/${quizId}`, headers: auth(alice.token) })
    expect(ok.statusCode).toBe(204)
  })
})
