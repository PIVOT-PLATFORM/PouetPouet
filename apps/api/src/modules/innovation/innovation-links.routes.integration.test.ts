import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { innovationRoutes } from './innovation.routes.js'
import { innovationLinksRoutes } from './innovation-links.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@innovation-links.int.test'
const ADMIN_EMAIL = 'admin@feedback.int.test'
async function cleanupAdmin() {
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } })
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('Innovation — liens externes', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string } // auteure
  let bob: { user: { id: string }; token: string } // étranger
  let admin: { user: { id: string }; token: string }
  let ficheId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp([
      { plugin: innovationRoutes, prefix: '/api/innovation' },
      { plugin: innovationLinksRoutes, prefix: '/api/innovation' },
    ])
    alice = await createTestUser(app, `alice${SUFFIX}`)
    bob = await createTestUser(app, `bob${SUFFIX}`)
    admin = await createTestUser(app, ADMIN_EMAIL)

    const created = await app.inject({
      method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token),
      payload: { title: 'Fiche avec liens', pitch: 'x' },
    })
    ficheId = created.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('GET /fiches/:id/links — vide au départ', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/links`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('POST /fiches/:id/links — un étranger ne peut pas ajouter → 403', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/links`, headers: auth(bob.token),
      payload: { label: 'Prototype', url: 'https://example.com/proto' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST /fiches/:id/links — l\'auteure peut ajouter un lien', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/links`, headers: auth(alice.token),
      payload: { label: 'Prototype Figma', url: 'https://figma.com/proto' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().label).toBe('Prototype Figma')
  })

  it('POST /fiches/:id/links — URL invalide → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/links`, headers: auth(alice.token),
      payload: { label: 'x', url: 'pas-une-url' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /fiches/:id/links — visible par un étranger (fiche publique)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/links`, headers: auth(bob.token) })
    expect(res.json().length).toBe(1)
  })

  it('DELETE /links/:linkId — un étranger ne peut pas supprimer → 403', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/links`, headers: auth(alice.token) })
    const linkId = list.json()[0].id
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/links/${linkId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /links/:linkId — un admin peut supprimer le lien d\'un tiers', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/links`, headers: auth(alice.token) })
    const linkId = list.json()[0].id
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/links/${linkId}`, headers: auth(admin.token) })
    expect(res.statusCode).toBe(204)
  })
})

describe('Innovation — cover/bannière (PATCH fiche)', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let ficheId: string
  const DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: innovationRoutes, prefix: '/api/innovation' }])
    alice = await createTestUser(app, `alice-img${SUFFIX}`)
    const created = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'Fiche image', pitch: 'x' } })
    ficheId = created.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('PATCH /fiches/:id — coverImage et bannerImage sont enregistrées', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(alice.token),
      payload: { coverImage: DATA_URL, bannerImage: DATA_URL },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().coverImage).toBe(DATA_URL)
    expect(res.json().bannerImage).toBe(DATA_URL)
  })

  it('PATCH /fiches/:id — coverImage: null retire l\'image', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(alice.token), payload: { coverImage: null } })
    expect(res.json().coverImage).toBeNull()
    expect(res.json().bannerImage).toBe(DATA_URL) // non touchée
  })
})
