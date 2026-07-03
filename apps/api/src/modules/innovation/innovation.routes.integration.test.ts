import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { innovationRoutes } from './innovation.routes.js'

const SUFFIX = '@innovation.int.test'
// ADMIN_EMAILS (vitest.integration.config.ts) est une valeur globale unique pour
// toute la suite d'intégration — même email littéral que feedback.routes.integration.test.ts.
const ADMIN_EMAIL = 'admin@feedback.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('Innovation — visibilité globale & permissions d\'édition', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string } // auteure
  let bob: { user: { id: string; email: string }; token: string } // étranger puis contributeur
  let admin: { user: { id: string }; token: string }
  let ficheId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: innovationRoutes, prefix: '/api/innovation' }])
    alice = await createTestUser(app, `alice${SUFFIX}`)
    bob = await createTestUser(app, `bob${SUFFIX}`)
    admin = await createTestUser(app, ADMIN_EMAIL)

    const created = await app.inject({
      method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token),
      payload: { title: 'Assistant interne', pitch: 'Un assistant pour les questions récurrentes.' },
    })
    ficheId = created.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('POST /fiches → 201, auteur renseigné, hasVoted false', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token),
      payload: { title: 'Autre idée', pitch: 'Un pitch court.' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.authorId).toBe(alice.user.id)
    expect(body.hasVoted).toBe(false)
    expect(body.votes).toBe(0)
    expect(body.contributors).toEqual([])
  })

  it('POST /fiches sans token → 401', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/fiches', payload: { title: 'x', pitch: 'x' } })
    expect(res.statusCode).toBe(401)
  })

  it('POST /fiches — pitch vide → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'x', pitch: '' } })
    expect(res.statusCode).toBe(400)
  })

  it('GET /fiches — visible par un étranger (visibilité globale)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/fiches', headers: auth(bob.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().some((f: { id: string }) => f.id === ficheId)).toBe(true)
  })

  it('GET /fiches/:id — visible par un étranger', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().id).toBe(ficheId)
  })

  it('PATCH /fiches/:id — un étranger ne peut pas éditer → 403', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(bob.token), payload: { title: 'pirate' } })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /fiches/:id — un étranger ne peut pas supprimer → 403', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/fiches/${ficheId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(403)
  })

  it('PATCH /fiches/:id — l\'auteure peut éditer sa fiche', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(alice.token), payload: { title: 'Titre édité' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Titre édité')
  })

  it('POST /fiches/:id/contributors — l\'auteure ajoute Bob comme contributeur', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/contributors`, headers: auth(alice.token),
      payload: { email: bob.user.email },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().contributors.map((c: { id: string }) => c.id)).toContain(bob.user.id)
  })

  it('PATCH /fiches/:id — Bob, désormais contributeur, peut éditer', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(bob.token), payload: { pitch: 'Pitch mis à jour par Bob.' } })
    expect(res.statusCode).toBe(200)
  })

  it('DELETE /fiches/:id/contributors/:userId — l\'auteure retire Bob', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/fiches/${ficheId}/contributors/${bob.user.id}`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(204)
    const check = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}`, headers: auth(alice.token) })
    expect(check.json().contributors.map((c: { id: string }) => c.id)).not.toContain(bob.user.id)
  })

  it('PATCH /fiches/:id — Bob, retiré des contributeurs, ne peut plus éditer → 403', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(bob.token), payload: { pitch: 'pirate again' } })
    expect(res.statusCode).toBe(403)
  })

  it('PATCH /fiches/:id — un admin peut éditer n\'importe quelle fiche', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(admin.token), payload: { title: 'Titre admin' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Titre admin')
  })

  it('PATCH /fiches/:id — passage à ABANDONNEE sans motif → 400', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(alice.token), payload: { status: 'ABANDONNEE' } })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH /fiches/:id — passage à ABANDONNEE avec motif → 200', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/innovation/fiches/${ficheId}`, headers: auth(alice.token),
      payload: { status: 'ABANDONNEE', abandonReason: 'Redondant avec un projet existant' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ABANDONNEE')
    expect(res.json().abandonReason).toBe('Redondant avec un projet existant')
  })

  it('DELETE /fiches/:id — l\'auteure peut supprimer sa fiche', async () => {
    const created = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'À supprimer', pitch: 'x' } })
    const id = created.json().id
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/fiches/${id}`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(204)
    const check = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${id}`, headers: auth(alice.token) })
    expect(check.statusCode).toBe(404)
  })

  it('DELETE /fiches/:id — fiche inexistante → 404', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/innovation/fiches/ckinexistant000000000000', headers: auth(admin.token) })
    expect(res.statusCode).toBe(404)
  })
})

describe('Innovation — votes (toggle + hasVoted par utilisateur)', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let bob: { user: { id: string }; token: string }
  let ficheId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: innovationRoutes, prefix: '/api/innovation' }])
    alice = await createTestUser(app, `alice-vote${SUFFIX}`)
    bob = await createTestUser(app, `bob-vote${SUFFIX}`)
    const created = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'Votable', pitch: 'x' } })
    ficheId = created.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('premier vote → hasVoted true, votes = 1', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/vote`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ hasVoted: true, votes: 1 })
  })

  it('re-vote du même utilisateur → toggle off, votes = 0', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/vote`, headers: auth(alice.token) })
    expect(res.json()).toEqual({ hasVoted: false, votes: 0 })
  })

  it('deux utilisateurs votent → votes = 2', async () => {
    await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/vote`, headers: auth(alice.token) })
    const res = await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/vote`, headers: auth(bob.token) })
    expect(res.json().votes).toBe(2)
  })

  it('GET /fiches — hasVoted est propre à chaque utilisateur', async () => {
    const carol = await createTestUser(app, `carol-vote${SUFFIX}`)
    const asAlice = await app.inject({ method: 'GET', url: '/api/innovation/fiches', headers: auth(alice.token) })
    const asCarol = await app.inject({ method: 'GET', url: '/api/innovation/fiches', headers: auth(carol.token) })
    const aliceFiche = asAlice.json().find((f: { id: string }) => f.id === ficheId)
    const carolFiche = asCarol.json().find((f: { id: string }) => f.id === ficheId)
    expect(aliceFiche.hasVoted).toBe(true)
    expect(carolFiche.hasVoted).toBe(false)
    expect(aliceFiche.votes).toBe(2)
  })

  it('vote sur une fiche inexistante → 404', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/fiches/ckinexistant000000000000/vote', headers: auth(alice.token) })
    expect(res.statusCode).toBe(404)
  })
})

describe('Innovation — filtres (statut, mine, recherche)', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let bob: { user: { id: string }; token: string }

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: innovationRoutes, prefix: '/api/innovation' }])
    alice = await createTestUser(app, `alice-filter${SUFFIX}`)
    bob = await createTestUser(app, `bob-filter${SUFFIX}`)
    await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'Portail RH nouvelle génération', pitch: 'x' } })
    await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(bob.token), payload: { title: 'Autre sujet', pitch: 'y' } })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('?mine=true ne renvoie que les fiches de l\'appelant (auteur ou contributeur)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/fiches?mine=true', headers: auth(alice.token) })
    const titles = res.json().map((f: { title: string }) => f.title)
    expect(titles).toContain('Portail RH nouvelle génération')
    expect(titles).not.toContain('Autre sujet')
  })

  it('?q= filtre par titre (insensible à la casse)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/fiches?q=portail', headers: auth(alice.token) })
    const titles = res.json().map((f: { title: string }) => f.title)
    expect(titles).toContain('Portail RH nouvelle génération')
    expect(titles).not.toContain('Autre sujet')
  })

  it('?status=IDEE ne renvoie que les fiches à ce statut', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/fiches?status=IDEE', headers: auth(alice.token) })
    expect(res.json().every((f: { status: string }) => f.status === 'IDEE')).toBe(true)
  })
})
