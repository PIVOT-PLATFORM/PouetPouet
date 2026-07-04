import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { innovationRoutes } from './innovation.routes.js'
import { challengeRoutes } from './challenge.routes.js'
import { innovationStatsRoutes } from './stats.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@innovation-stats.int.test'
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
  { plugin: innovationStatsRoutes, prefix: '/api/innovation' },
]

describe('Innovation v2-A — notifications', () => {
  let app: FastifyInstance
  let admin: { user: { id: string }; token: string }
  let alice: { user: { id: string }; token: string } // auteure
  let bob: { user: { id: string; email: string }; token: string } // contributeur
  let ficheId: string
  let challengeId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp(PLUGINS)
    admin = await createTestUser(app, ADMIN_EMAIL)
    alice = await createTestUser(app, `alice${SUFFIX}`)
    bob = await createTestUser(app, `bob${SUFFIX}`)

    const fiche = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'Fiche notifiable', pitch: 'x' } })
    ficheId = fiche.json().id
    const challenge = await prisma.innovationChallenge.create({ data: { nom: 'Challenge notif', description: 'x', ownerId: admin.user.id, status: 'OPEN' } })
    challengeId = challenge.id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('ajout comme contributeur → notification INNOVATION_CONTRIBUTOR_ADDED pour l\'ajouté', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/contributors`, headers: auth(alice.token),
      payload: { email: bob.user.email },
    })
    expect(res.statusCode).toBe(201)
    const notif = await prisma.notification.findFirst({ where: { userId: bob.user.id, type: 'INNOVATION_CONTRIBUTOR_ADDED' } })
    expect(notif).not.toBeNull()
    expect(notif!.link).toBe(`/innovation/${ficheId}`)
  })

  it('inscription par un contributeur → notifications pour l\'auteure et l\'owner du challenge, pas pour l\'acteur', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries`, headers: auth(bob.token),
      payload: { ficheId },
    })
    expect(res.statusCode).toBe(201)

    const authorNotif = await prisma.notification.findFirst({ where: { userId: alice.user.id, type: 'INNOVATION_FICHE_SUBMITTED' } })
    expect(authorNotif).not.toBeNull()
    const ownerNotif = await prisma.notification.findFirst({ where: { userId: admin.user.id, type: 'INNOVATION_FICHE_SUBMITTED' } })
    expect(ownerNotif).not.toBeNull()
    const actorNotif = await prisma.notification.findFirst({ where: { userId: bob.user.id, type: 'INNOVATION_FICHE_SUBMITTED' } })
    expect(actorNotif).toBeNull()
  })

  it('désignation des lauréats → notification pour l\'auteure et le contributeur, pas pour l\'admin acteur', async () => {
    await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${challengeId}`, headers: auth(admin.token), payload: { status: 'EVALUATION' } })
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/challenges/${challengeId}/winners`, headers: auth(admin.token),
      payload: { ficheIds: [ficheId] },
    })
    expect(res.statusCode).toBe(200)

    const aliceNotif = await prisma.notification.findFirst({ where: { userId: alice.user.id, type: 'INNOVATION_FICHE_WINNER' } })
    expect(aliceNotif).not.toBeNull()
    const bobNotif = await prisma.notification.findFirst({ where: { userId: bob.user.id, type: 'INNOVATION_FICHE_WINNER' } })
    expect(bobNotif).not.toBeNull()
    const adminNotif = await prisma.notification.findFirst({ where: { userId: admin.user.id, type: 'INNOVATION_FICHE_WINNER' } })
    expect(adminNotif).toBeNull()
  })

  it('re-sauvegarder les mêmes lauréats ne re-notifie pas', async () => {
    const before = await prisma.notification.count({ where: { userId: alice.user.id, type: 'INNOVATION_FICHE_WINNER' } })
    await app.inject({
      method: 'POST', url: `/api/innovation/challenges/${challengeId}/winners`, headers: auth(admin.token),
      payload: { ficheIds: [ficheId] },
    })
    const after = await prisma.notification.count({ where: { userId: alice.user.id, type: 'INNOVATION_FICHE_WINNER' } })
    expect(after).toBe(before)
  })
})

describe('Innovation v2-A — stats du dashboard', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let bob: { user: { id: string; email: string }; token: string }

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp(PLUGINS)
    alice = await createTestUser(app, `alice-stats${SUFFIX}`)
    bob = await createTestUser(app, `bob-stats${SUFFIX}`)

    // Jeu de données contrôlé : 2 fiches d'Alice (1 IDEE avec 2 votes, 1 ADOPTEE), Bob contributeur d'une.
    const f1 = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'Star des votes', pitch: 'x' } })
    const f1Id = f1.json().id
    await app.inject({ method: 'POST', url: `/api/innovation/fiches/${f1Id}/vote`, headers: auth(alice.token) })
    await app.inject({ method: 'POST', url: `/api/innovation/fiches/${f1Id}/vote`, headers: auth(bob.token) })
    await app.inject({ method: 'POST', url: `/api/innovation/fiches/${f1Id}/contributors`, headers: auth(alice.token), payload: { email: bob.user.email } })

    const f2 = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'Déjà adoptée', pitch: 'x' } })
    await app.inject({ method: 'PATCH', url: `/api/innovation/fiches/${f2.json().id}`, headers: auth(alice.token), payload: { status: 'ADOPTEE' } })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('GET /stats — compte les fiches, statuts, votes et contributeurs du jeu de données', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/stats', headers: auth(bob.token) })
    expect(res.statusCode).toBe(200)
    const stats = res.json()

    // La suite partage la DB : on vérifie des minorants et les entrées connues,
    // pas des égalités strictes sur les totaux globaux.
    expect(stats.totalFiches).toBeGreaterThanOrEqual(2)
    expect(stats.byStatus.ADOPTEE).toBeGreaterThanOrEqual(1)
    expect(stats.recentFiches).toBeGreaterThanOrEqual(2)
    expect(stats.contributorCount).toBeGreaterThanOrEqual(1)

    const star = stats.topFiches.find((f: { title: string }) => f.title === 'Star des votes')
    expect(star).toBeDefined()
    expect(star.votes).toBe(2)
    expect(star.hasVoted).toBe(true) // bob a voté
  })

  it('GET /stats — sans token → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/stats' })
    expect(res.statusCode).toBe(401)
  })
})

describe('Innovation PR E — gamification (points, badges, leaderboard)', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string } // 2 fiches, 1 votée deux fois
  let bob: { user: { id: string }; token: string } // 0 fiche, juste votant

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    app = await buildTestApp(PLUGINS)
    alice = await createTestUser(app, `alice-gami${SUFFIX}`)
    bob = await createTestUser(app, `bob-gami${SUFFIX}`)

    const f1 = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'Gamif 1', pitch: 'x' } })
    await app.inject({ method: 'POST', url: `/api/innovation/fiches/${f1.json().id}/vote`, headers: auth(alice.token) })
    await app.inject({ method: 'POST', url: `/api/innovation/fiches/${f1.json().id}/vote`, headers: auth(bob.token) })
    await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token), payload: { title: 'Gamif 2', pitch: 'x' } })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('GET /stats/me — alice a 2 fiches et 2 votes reçus → points = 2×1 + 2×2 = 6, badge first-fiche obtenu', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/stats/me', headers: auth(alice.token) })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ficheCount).toBe(2)
    expect(body.votesReceived).toBe(2)
    expect(body.points).toBe(6)
    expect(body.badges.find((b: { id: string }) => b.id === 'first-fiche').earned).toBe(true)
    expect(body.badges.find((b: { id: string }) => b.id === 'five-fiches').earned).toBe(false)
  })

  it('GET /stats/me — bob n\'a publié aucune fiche → 0 point, aucun badge', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/stats/me', headers: auth(bob.token) })
    const body = res.json()
    expect(body.ficheCount).toBe(0)
    expect(body.points).toBe(0)
    expect(body.badges.every((b: { earned: boolean }) => !b.earned)).toBe(true)
  })

  it('GET /stats — topContributors inclut alice avec ses points', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/stats', headers: auth(alice.token) })
    const top = res.json().topContributors
    const aliceEntry = top.find((c: { userId: string }) => c.userId === alice.user.id)
    expect(aliceEntry).toBeDefined()
    expect(aliceEntry.points).toBe(6)
    expect(aliceEntry.name).toBeTruthy()
  })
})
