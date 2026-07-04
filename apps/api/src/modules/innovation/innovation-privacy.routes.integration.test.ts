import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { innovationRoutes } from './innovation.routes.js'
import { innovationStatsRoutes } from './stats.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@innovation-privacy.int.test'
const ADMIN_EMAIL = 'admin@feedback.int.test'
async function cleanupAdmin() {
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } })
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

const PLUGINS = [
  { plugin: innovationRoutes, prefix: '/api/innovation' },
  { plugin: innovationStatsRoutes, prefix: '/api/innovation' },
]

describe('Innovation — favoris', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let bob: { user: { id: string }; token: string }
  let ficheId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp(PLUGINS)
    alice = await createTestUser(app, `alice-fav${SUFFIX}`)
    bob = await createTestUser(app, `bob-fav${SUFFIX}`)
    const created = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'Favorisable', pitch: 'x' } })
    ficheId = created.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('POST /fiches/:id/favorite — premier appel → isFavorite true', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/favorite`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ isFavorite: true })
  })

  it('POST /fiches/:id/favorite — second appel → toggle off', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/favorite`, headers: auth(bob.token) })
    expect(res.json()).toEqual({ isFavorite: false })
  })

  it('GET /fiches?favorite=true — ne renvoie que les fiches favorites de l\'appelant', async () => {
    await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/favorite`, headers: auth(bob.token) })
    const asBob = await app.inject({ method: 'GET', url: '/api/innovation/fiches?favorite=true', headers: auth(bob.token) })
    expect(asBob.json().some((f: { id: string }) => f.id === ficheId)).toBe(true)

    const asAlice = await app.inject({ method: 'GET', url: '/api/innovation/fiches?favorite=true', headers: auth(alice.token) })
    expect(asAlice.json().some((f: { id: string }) => f.id === ficheId)).toBe(false)
  })

  it('GET /fiches/:id — isFavorite propre à chaque utilisateur', async () => {
    const asBob = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}`, headers: auth(bob.token) })
    const asAlice = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}`, headers: auth(alice.token) })
    expect(asBob.json().isFavorite).toBe(true)
    expect(asAlice.json().isFavorite).toBe(false)
  })
})

describe('Innovation — visibilité PRIVATE (anti-énumération)', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string } // auteure
  let bob: { user: { id: string; email: string }; token: string } // contributeur (ajouté plus bas)
  let carol: { user: { id: string }; token: string } // étrangère
  let admin: { user: { id: string }; token: string }
  let ficheId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp(PLUGINS)
    alice = await createTestUser(app, `alice-priv${SUFFIX}`)
    bob = await createTestUser(app, `bob-priv${SUFFIX}`)
    carol = await createTestUser(app, `carol-priv${SUFFIX}`)
    admin = await createTestUser(app, ADMIN_EMAIL)

    const created = await app.inject({
      method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token),
      payload: { title: 'Fiche confidentielle', pitch: 'x', visibility: 'PRIVATE' },
    })
    ficheId = created.json().id
    await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/contributors`, headers: auth(alice.token), payload: { email: bob.user.email } })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('POST /fiches — visibility PRIVATE persistée', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}`, headers: auth(alice.token) })
    expect(res.json().visibility).toBe('PRIVATE')
  })

  it('GET /fiches — invisible pour une étrangère', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/fiches', headers: auth(carol.token) })
    expect(res.json().some((f: { id: string }) => f.id === ficheId)).toBe(false)
  })

  it('GET /fiches — visible pour l\'auteure, le contributeur et un admin', async () => {
    const asAlice = await app.inject({ method: 'GET', url: '/api/innovation/fiches', headers: auth(alice.token) })
    const asBob = await app.inject({ method: 'GET', url: '/api/innovation/fiches', headers: auth(bob.token) })
    const asAdmin = await app.inject({ method: 'GET', url: '/api/innovation/fiches', headers: auth(admin.token) })
    expect(asAlice.json().some((f: { id: string }) => f.id === ficheId)).toBe(true)
    expect(asBob.json().some((f: { id: string }) => f.id === ficheId)).toBe(true)
    expect(asAdmin.json().some((f: { id: string }) => f.id === ficheId)).toBe(true)
  })

  it('GET /fiches/:id — 404 anti-énumération pour une étrangère', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}`, headers: auth(carol.token) })
    expect(res.statusCode).toBe(404)
  })

  it('GET /fiches/:id — 200 pour le contributeur', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(200)
  })

  it('PATCH /fiches/:id — 404 (pas 403) pour une étrangère', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(carol.token), payload: { title: 'pirate' } })
    expect(res.statusCode).toBe(404)
  })

  it('POST /fiches/:id/vote — 404 pour une étrangère', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/vote`, headers: auth(carol.token) })
    expect(res.statusCode).toBe(404)
  })

  it('POST /fiches/:id/favorite — 404 pour une étrangère', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/favorite`, headers: auth(carol.token) })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /fiches/:id — 403 (pas 404) pour le contributeur, qui peut voir mais pas supprimer', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/fiches/${ficheId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /fiches/:id — 404 pour une étrangère', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/fiches/${ficheId}`, headers: auth(carol.token) })
    expect(res.statusCode).toBe(404)
  })

  it('PATCH /fiches/:id — l\'auteure peut repasser la fiche en PUBLIC', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(alice.token), payload: { visibility: 'PUBLIC' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().visibility).toBe('PUBLIC')
    const nowVisible = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}`, headers: auth(carol.token) })
    expect(nowVisible.statusCode).toBe(200)
  })
})

describe('Innovation — les stats excluent les fiches PRIVATE', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp(PLUGINS)
    alice = await createTestUser(app, `alice-stats-priv${SUFFIX}`)
    await app.inject({
      method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token),
      payload: { title: 'Secrète des stats', pitch: 'x', visibility: 'PRIVATE' },
    })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('GET /stats — topFiches ne contient jamais de fiche PRIVATE', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/stats', headers: auth(alice.token) })
    expect(res.json().topFiches.some((f: { title: string }) => f.title === 'Secrète des stats')).toBe(false)
  })
})
