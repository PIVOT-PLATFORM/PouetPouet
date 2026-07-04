import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { innovationRoutes } from './innovation.routes.js'
import { challengeRoutes } from './challenge.routes.js'
import { scoringRoutes } from './scoring.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@innovation-scoring.int.test'
// ADMIN_EMAILS (vitest.integration.config.ts) est une valeur globale unique — nettoyage
// explicite par email exact requis (contrainte unique sur User.email).
const ADMIN_EMAIL = 'admin@feedback.int.test'
async function cleanupAdmin() {
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } })
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

const PLUGINS = [
  { plugin: innovationRoutes, prefix: '/api/innovation' },
  { plugin: challengeRoutes, prefix: '/api/innovation' },
  { plugin: scoringRoutes, prefix: '/api/innovation' },
]

describe('Innovation Scoring — critères', () => {
  let app: FastifyInstance
  let admin: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let challengeId: string
  let criterionId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp(PLUGINS)
    admin = await createTestUser(app, ADMIN_EMAIL)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)
    const challenge = await prisma.innovationChallenge.create({ data: { nom: 'Critères', description: 'x', ownerId: admin.user.id, status: 'DRAFT' } })
    challengeId = challenge.id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('POST /criteria — un étranger ne peut pas créer → 403', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/criteria`, headers: auth(stranger.token), payload: { label: 'x', poids: 1 } })
    expect(res.statusCode).toBe(403)
  })

  it('POST /criteria — l\'admin crée un critère (DRAFT autorisé)', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/criteria`, headers: auth(admin.token), payload: { label: 'Impact', poids: 3 } })
    expect(res.statusCode).toBe(201)
    criterionId = res.json().id
  })

  it('GET /criteria — visible par un étranger (challenge public)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/criteria`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().length).toBe(1)
  })

  it('critères verrouillés une fois le challenge en EVALUATION → 400', async () => {
    await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${challengeId}`, headers: auth(admin.token), payload: { status: 'OPEN' } })
    await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${challengeId}`, headers: auth(admin.token), payload: { status: 'EVALUATION' } })
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/criteria`, headers: auth(admin.token), payload: { label: 'Trop tard', poids: 1 } })
    expect(res.statusCode).toBe(400)
    const del = await app.inject({ method: 'DELETE', url: `/api/innovation/challenges/${challengeId}/criteria/${criterionId}`, headers: auth(admin.token) })
    expect(del.statusCode).toBe(400)
  })
})

describe('Innovation Scoring — jurés', () => {
  let app: FastifyInstance
  let admin: { user: { id: string }; token: string }
  let juror: { user: { id: string; email: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let challengeId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp(PLUGINS)
    admin = await createTestUser(app, ADMIN_EMAIL)
    juror = await createTestUser(app, `juror${SUFFIX}`)
    stranger = await createTestUser(app, `stranger-jury${SUFFIX}`)
    const challenge = await prisma.innovationChallenge.create({ data: { nom: 'Jury', description: 'x', ownerId: admin.user.id } })
    challengeId = challenge.id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('POST /jurors — un étranger ne peut pas inviter → 403', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/jurors`, headers: auth(stranger.token), payload: { email: juror.user.email } })
    expect(res.statusCode).toBe(403)
  })

  it('POST /jurors — l\'admin invite un juré + notification', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/jurors`, headers: auth(admin.token), payload: { email: juror.user.email } })
    expect(res.statusCode).toBe(201)
    const notif = await prisma.notification.findFirst({ where: { userId: juror.user.id, type: 'INNOVATION_JUROR_INVITED' } })
    expect(notif).not.toBeNull()
  })

  it('GET /jurors — un étranger ne peut pas lister → 403', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/jurors`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /jurors/:userId — l\'admin retire un juré', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/challenges/${challengeId}/jurors/${juror.user.id}`, headers: auth(admin.token) })
    expect(res.statusCode).toBe(204)
    const list = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/jurors`, headers: auth(admin.token) })
    expect(list.json()).toEqual([])
  })
})

describe('Innovation Scoring — notation et classement', () => {
  let app: FastifyInstance
  let admin: { user: { id: string }; token: string }
  let author: { user: { id: string }; token: string }
  let juror1: { user: { id: string; email: string }; token: string }
  let juror2: { user: { id: string; email: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let challengeId: string
  let ficheId: string
  let criterionImpactId: string
  let criterionFaisabiliteId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp(PLUGINS)
    admin = await createTestUser(app, ADMIN_EMAIL)
    author = await createTestUser(app, `author-score${SUFFIX}`)
    juror1 = await createTestUser(app, `juror1${SUFFIX}`)
    juror2 = await createTestUser(app, `juror2${SUFFIX}`)
    stranger = await createTestUser(app, `stranger-score${SUFFIX}`)

    const challenge = await prisma.innovationChallenge.create({ data: { nom: 'Notation', description: 'x', ownerId: admin.user.id, status: 'OPEN' } })
    challengeId = challenge.id

    const c1 = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/criteria`, headers: auth(admin.token), payload: { label: 'Impact', poids: 3 } })
    criterionImpactId = c1.json().id
    const c2 = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/criteria`, headers: auth(admin.token), payload: { label: 'Faisabilité', poids: 1 } })
    criterionFaisabiliteId = c2.json().id

    await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/jurors`, headers: auth(admin.token), payload: { email: juror1.user.email } })
    await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/jurors`, headers: auth(admin.token), payload: { email: juror2.user.email } })

    const fiche = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(author.token), payload: { title: 'À noter', pitch: 'x' } })
    ficheId = fiche.json().id
    await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries`, headers: auth(author.token), payload: { ficheId } })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('POST /scores — un non-juré ne peut pas noter → 403', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries/${ficheId}/scores`, headers: auth(stranger.token),
      payload: { scores: [{ criterionId: criterionImpactId, note: 8 }] },
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST /scores — refusé avant EVALUATION → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries/${ficheId}/scores`, headers: auth(juror1.token),
      payload: { scores: [{ criterionId: criterionImpactId, note: 8 }] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /ranking — 403 pendant OPEN pour un non-admin', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/ranking`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })

  it('un juré note la fiche une fois en EVALUATION', async () => {
    await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${challengeId}`, headers: auth(admin.token), payload: { status: 'EVALUATION' } })
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries/${ficheId}/scores`, headers: auth(juror1.token),
      payload: { scores: [{ criterionId: criterionImpactId, note: 8 }, { criterionId: criterionFaisabiliteId, note: 4 }] },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(2)
  })

  it('POST /scores — critère invalide (autre challenge) → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries/${ficheId}/scores`, headers: auth(juror1.token),
      payload: { scores: [{ criterionId: 'ckinexistant000000000000', note: 5 }] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('renoter met à jour la note existante (upsert, pas de doublon)', async () => {
    await app.inject({
      method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries/${ficheId}/scores`, headers: auth(juror1.token),
      payload: { scores: [{ criterionId: criterionImpactId, note: 6 }] },
    })
    const mine = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/entries/${ficheId}/scores`, headers: auth(juror1.token) })
    const impactScores = mine.json().filter((s: { criterionId: string }) => s.criterionId === criterionImpactId)
    expect(impactScores).toHaveLength(1)
    expect(impactScores[0].note).toBe(6)
  })

  it('GET /ranking — visible par l\'admin pendant EVALUATION, moyenne pondérée correcte avec un seul juré', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/ranking`, headers: auth(admin.token) })
    expect(res.statusCode).toBe(200)
    const entry = res.json().find((r: { ficheId: string }) => r.ficheId === ficheId)
    // juror1 seul a noté : impact=6 (poids 3), faisabilité=4 (poids 1) → (6*3+4*1)/4 = 5.5
    expect(entry.weightedAverage).toBe(5.5)
  })

  it('un second juré note → la moyenne se recalcule sur les deux jurés', async () => {
    await app.inject({
      method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries/${ficheId}/scores`, headers: auth(juror2.token),
      payload: { scores: [{ criterionId: criterionImpactId, note: 10 }, { criterionId: criterionFaisabiliteId, note: 10 }] },
    })
    const res = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/ranking`, headers: auth(admin.token) })
    const entry = res.json().find((r: { ficheId: string }) => r.ficheId === ficheId)
    // impact: moyenne(6,10)=8 (poids 3) ; faisabilité: moyenne(4,10)=7 (poids 1) → (8*3+7*1)/4 = 7.75
    expect(entry.weightedAverage).toBe(7.75)
  })

  it('GET /ranking — 403 pour un étranger tant que le challenge n\'est pas CLOSED', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/ranking`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })

  it('GET /ranking.csv — 403 pour un étranger tant que le challenge n\'est pas CLOSED', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/ranking.csv`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })

  it('GET /ranking — visible par tous une fois CLOSED', async () => {
    await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${challengeId}`, headers: auth(admin.token), payload: { status: 'CLOSED' } })
    const res = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/ranking`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(200)
  })

  it('GET /ranking.csv — visible par tous une fois CLOSED, colonnes et BOM Excel', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/challenges/${challengeId}/ranking.csv`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.body.startsWith('﻿')).toBe(true)
    expect(res.body).toContain('"Rang","Fiche","Auteur","Score pondéré"')
    expect(res.body).toContain('"À noter"')
    expect(res.body).toContain('"7.75"')
  })
})
