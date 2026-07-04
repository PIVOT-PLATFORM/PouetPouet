import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { innovationRoutes } from './innovation.routes.js'
import { innovationCommentsRoutes } from './innovation-comments.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@innovation-comments.int.test'
const ADMIN_EMAIL = 'admin@feedback.int.test'
async function cleanupAdmin() {
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } })
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('Innovation — commentaires sur les fiches', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string } // auteure de la fiche
  let bob: { user: { id: string }; token: string } // étranger, peut commenter (visibilité globale)
  let admin: { user: { id: string }; token: string }
  let ficheId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp([
      { plugin: innovationRoutes, prefix: '/api/innovation' },
      { plugin: innovationCommentsRoutes, prefix: '/api/innovation' },
    ])
    alice = await createTestUser(app, `alice${SUFFIX}`)
    bob = await createTestUser(app, `bob${SUFFIX}`)
    admin = await createTestUser(app, ADMIN_EMAIL)

    const created = await app.inject({
      method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token),
      payload: { title: 'Fiche commentable', pitch: 'x' },
    })
    ficheId = created.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('GET /fiches/:id/comments — vide au départ', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/comments`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('POST /fiches/:id/comments — un étranger peut commenter (visibilité globale)', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/comments`, headers: auth(bob.token),
      payload: { body: 'Bonne idée, je pense qu\'on pourrait aussi...' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().author.id).toBe(bob.user.id)
  })

  it('POST /fiches/:id/comments — corps vide → 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/comments`, headers: auth(alice.token), payload: { body: '' } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /fiches/:id/comments — fiche inexistante → 404', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/fiches/ckinexistant000000000000/comments', headers: auth(alice.token), payload: { body: 'x' } })
    expect(res.statusCode).toBe(404)
  })

  it('GET /fiches/:id/comments — ordre chronologique croissant', async () => {
    await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/comments`, headers: auth(alice.token), payload: { body: 'Deuxième commentaire' } })
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/comments`, headers: auth(alice.token) })
    const bodies = res.json().map((c: { body: string }) => c.body)
    expect(bodies[0]).toBe('Bonne idée, je pense qu\'on pourrait aussi...')
    expect(bodies[1]).toBe('Deuxième commentaire')
  })

  it('PATCH /fiches/:id/comments/:commentId — l\'auteur du commentaire peut le modifier', async () => {
    const posted = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/comments`, headers: auth(bob.token), payload: { body: 'Avant édition' } })
    const commentId = posted.json().id
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}/comments/${commentId}`, headers: auth(bob.token), payload: { body: 'Après édition' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().body).toBe('Après édition')
  })

  it('PATCH /fiches/:id/comments/:commentId — un tiers ne peut pas modifier → 403', async () => {
    const posted = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/comments`, headers: auth(bob.token), payload: { body: 'À ne pas toucher' } })
    const commentId = posted.json().id
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}/comments/${commentId}`, headers: auth(alice.token), payload: { body: 'piraté' } })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /fiches/:id/comments/:commentId — un tiers ne peut pas supprimer → 403', async () => {
    const posted = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/comments`, headers: auth(bob.token), payload: { body: 'À supprimer par erreur ?' } })
    const commentId = posted.json().id
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/fiches/${ficheId}/comments/${commentId}`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /fiches/:id/comments/:commentId — l\'auteur peut supprimer son commentaire', async () => {
    const posted = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/comments`, headers: auth(bob.token), payload: { body: 'À supprimer' } })
    const commentId = posted.json().id
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/fiches/${ficheId}/comments/${commentId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(204)
  })

  it('DELETE /fiches/:id/comments/:commentId — un admin peut supprimer le commentaire d\'un tiers', async () => {
    const posted = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/comments`, headers: auth(bob.token), payload: { body: 'Modération admin' } })
    const commentId = posted.json().id
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/fiches/${ficheId}/comments/${commentId}`, headers: auth(admin.token) })
    expect(res.statusCode).toBe(204)
  })
})
