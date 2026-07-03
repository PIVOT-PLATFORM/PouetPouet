import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { innovationRoutes } from './innovation.routes.js'
import { challengeRoutes } from './challenge.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@innovation-challenge.int.test'
// ADMIN_EMAILS (vitest.integration.config.ts) est une valeur globale unique pour toute
// la suite d'intégration. Son suffixe ne correspond à aucun SUFFIX de test (dont le
// nôtre) : cleanupUsers(SUFFIX) ne le supprime jamais — nettoyage explicite par email
// exact requis pour éviter qu'il ne fuite d'un fichier/describe à l'autre (contrainte
// unique sur User.email).
const ADMIN_EMAIL = 'admin@feedback.int.test'
async function cleanupAdmin() {
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } })
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('Innovation Challenges — administration & transitions de statut', () => {
  let app: FastifyInstance
  let admin: { user: { id: string }; token: string }
  let owner: { user: { id: string }; token: string } // owner non-admin d'un challenge créé directement en base
  let stranger: { user: { id: string }; token: string }
  let challengeId: string
  let ownerChallengeId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp([
      { plugin: innovationRoutes, prefix: '/api/innovation' },
      { plugin: challengeRoutes, prefix: '/api/innovation' },
    ])
    admin = await createTestUser(app, ADMIN_EMAIL)
    owner = await createTestUser(app, `owner${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    // Challenge appartenant à un owner NON-admin, pour tester ses droits propres
    // (distincts de ceux d'un admin app) — POST /challenges étant réservé aux admins,
    // impossible de le créer via l'API avec un owner non-admin.
    const ownerChallenge = await prisma.innovationChallenge.create({
      data: { nom: 'Challenge owner', description: 'x', ownerId: owner.user.id, status: 'OPEN' },
    })
    ownerChallengeId = ownerChallenge.id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('POST /challenges — un non-admin ne peut pas créer → 403', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/challenges', headers: auth(owner.token), payload: { nom: 'x', description: 'y' } })
    expect(res.statusCode).toBe(403)
  })

  it('POST /challenges — un admin crée un challenge (DRAFT, il en devient owner)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/innovation/challenges', headers: auth(admin.token),
      payload: { nom: 'Hackathon 2026', description: 'Un challenge trimestriel.', theme: 'IA' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    challengeId = body.id
    expect(body.status).toBe('DRAFT')
    expect(body.ownerId).toBe(admin.user.id)
    expect(body.entryCount).toBe(0)
  })

  it('GET /challenges — visible par un étranger', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/challenges', headers: auth(stranger.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().some((c: { id: string }) => c.id === challengeId)).toBe(true)
  })

  it('GET /challenges/:id — canManage vrai pour l\'owner (admin), faux pour un étranger', async () => {
    const asOwner = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}`, headers: auth(admin.token) })
    expect(asOwner.json().canManage).toBe(true)
    const asStranger = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}`, headers: auth(stranger.token) })
    expect(asStranger.statusCode).toBe(200)
    expect(asStranger.json().canManage).toBe(false)
  })

  it('PATCH /challenges/:id — un étranger ne peut pas modifier → 403', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${challengeId}`, headers: auth(stranger.token), payload: { nom: 'pirate' } })
    expect(res.statusCode).toBe(403)
  })

  it('PATCH /challenges/:id — l\'admin (owner) fait avancer DRAFT → OPEN', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${challengeId}`, headers: auth(admin.token), payload: { status: 'OPEN' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('OPEN')
  })

  it('PATCH /challenges/:id — un owner non-admin peut avancer OPEN → EVALUATION', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${ownerChallengeId}`, headers: auth(owner.token), payload: { status: 'EVALUATION' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('EVALUATION')
  })

  it('PATCH /challenges/:id — un owner non-admin ne peut pas reculer EVALUATION → OPEN → 400', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${ownerChallengeId}`, headers: auth(owner.token), payload: { status: 'OPEN' } })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH /challenges/:id — un admin app peut reculer EVALUATION → OPEN', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${ownerChallengeId}`, headers: auth(admin.token), payload: { status: 'OPEN' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('OPEN')
  })

  it('DELETE /challenges/:id — un étranger ne peut pas supprimer → 403', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/challenges/${challengeId}`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /challenges/:id — challenge inexistant → 404', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/innovation/challenges/ckinexistant000000000000', headers: auth(admin.token) })
    expect(res.statusCode).toBe(404)
  })
})

describe('Innovation Challenges — administration déléguée via ModuleShare', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let editor: { user: { id: string }; token: string }
  let challengeId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: innovationRoutes, prefix: '/api/innovation' },
      { plugin: challengeRoutes, prefix: '/api/innovation' },
    ])
    owner = await createTestUser(app, `co-owner${SUFFIX}`)
    editor = await createTestUser(app, `co-editor${SUFFIX}`)

    const challenge = await prisma.innovationChallenge.create({ data: { nom: 'Co-admin', description: 'x', ownerId: owner.user.id } })
    challengeId = challenge.id
    await prisma.moduleShare.create({ data: { module: 'challenge', resourceId: challengeId, userId: editor.user.id, role: 'EDITOR' } })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('un éditeur partagé (ModuleShare) peut administrer le challenge', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${challengeId}`, headers: auth(editor.token), payload: { status: 'OPEN' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('OPEN')
  })
})

describe('Innovation Challenges — inscriptions & lauréats', () => {
  let app: FastifyInstance
  let admin: { user: { id: string }; token: string }
  let author: { user: { id: string }; token: string }
  let contributor: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let openChallengeId: string
  let draftChallengeId: string
  let ficheId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp([
      { plugin: innovationRoutes, prefix: '/api/innovation' },
      { plugin: challengeRoutes, prefix: '/api/innovation' },
    ])
    admin = await createTestUser(app, ADMIN_EMAIL)
    author = await createTestUser(app, `author${SUFFIX}`)
    contributor = await createTestUser(app, `contributor${SUFFIX}`)
    stranger = await createTestUser(app, `stranger-entries${SUFFIX}`)

    const openChallenge = await prisma.innovationChallenge.create({ data: { nom: 'Ouvert', description: 'x', ownerId: admin.user.id, status: 'OPEN' } })
    openChallengeId = openChallenge.id
    const draftChallenge = await prisma.innovationChallenge.create({ data: { nom: 'Brouillon', description: 'x', ownerId: admin.user.id, status: 'DRAFT' } })
    draftChallengeId = draftChallenge.id

    const fiche = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(author.token), payload: { title: 'Idée à inscrire', pitch: 'x' } })
    ficheId = fiche.json().id
    await app.inject({ method: 'POST', url: `/api/innovation/fiches/${ficheId}/contributors`, headers: auth(author.token), payload: { email: `contributor${SUFFIX}` } })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('POST /entries — un étranger à la fiche ne peut pas l\'inscrire → 403', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${openChallengeId}/entries`, headers: auth(stranger.token), payload: { ficheId } })
    expect(res.statusCode).toBe(403)
  })

  it('POST /entries — un challenge en DRAFT n\'accepte pas d\'inscription → 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${draftChallengeId}/entries`, headers: auth(author.token), payload: { ficheId } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /entries — l\'auteur inscrit sa fiche à un challenge OPEN → 201', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${openChallengeId}/entries`, headers: auth(author.token), payload: { ficheId } })
    expect(res.statusCode).toBe(201)
  })

  it('POST /entries — double inscription → 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${openChallengeId}/entries`, headers: auth(author.token), payload: { ficheId } })
    expect(res.statusCode).toBe(400)
  })

  it('GET /challenges/:id — la fiche inscrite apparaît dans les entries', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${openChallengeId}`, headers: auth(admin.token) })
    expect(res.json().entries.map((e: { fiche: { id: string } }) => e.fiche.id)).toContain(ficheId)
  })

  it('GET /fiches/:id/challenges — la fiche liste ses inscriptions', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/challenges`, headers: auth(author.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().map((e: { challenge: { id: string } }) => e.challenge.id)).toContain(openChallengeId)
  })

  it('POST /winners — refusé quand le challenge est encore OPEN (pas EVALUATION/CLOSED) → 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${openChallengeId}/winners`, headers: auth(admin.token), payload: { ficheIds: [ficheId] } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /winners — un non-admin du challenge ne peut pas désigner de lauréat → 403', async () => {
    await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${openChallengeId}`, headers: auth(admin.token), payload: { status: 'EVALUATION' } })
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${openChallengeId}/winners`, headers: auth(author.token), payload: { ficheIds: [ficheId] } })
    expect(res.statusCode).toBe(403)
  })

  it('POST /winners — l\'admin du challenge désigne la fiche lauréate en EVALUATION', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${openChallengeId}/winners`, headers: auth(admin.token), payload: { ficheIds: [ficheId] } })
    expect(res.statusCode).toBe(200)
    const entry = res.json().find((e: { fiche: { id: string } }) => e.fiche.id === ficheId)
    expect(entry.isWinner).toBe(true)
  })

  it('DELETE /entries/:ficheId — le contributeur (co-soumetteur potentiel) ne peut pas retirer l\'inscription d\'un autre sans être admin → 403', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/challenges/${openChallengeId}/entries/${ficheId}`, headers: auth(contributor.token) })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /entries/:ficheId — le soumetteur original peut retirer son inscription', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/challenges/${openChallengeId}/entries/${ficheId}`, headers: auth(author.token) })
    expect(res.statusCode).toBe(204)
    const check = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/challenges`, headers: auth(author.token) })
    expect(check.json()).toEqual([])
  })
})
