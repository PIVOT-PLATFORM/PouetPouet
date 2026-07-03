import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { innovationRoutes } from './innovation.routes.js'
import { challengeRoutes } from './challenge.routes.js'
import { innovationOrgRoutes } from './org.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@innovation-org.int.test'
// ADMIN_EMAILS (vitest.integration.config.ts) est une valeur globale unique pour toute
// la suite d'intégration. Son suffixe ne correspond à aucun SUFFIX de test : nettoyage
// explicite par email exact requis (contrainte unique sur User.email).
const ADMIN_EMAIL = 'admin@feedback.int.test'
async function cleanupAdmin() {
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } })
}

// InnovationOrgUnit et InnovationCategory ne sont rattachées à aucun utilisateur
// (référentiel admin global, pas de ownerId) : cleanupUsers(SUFFIX) ne les touche
// jamais. Ce fichier est le seul à créer des lignes dans ces deux tables — on peut
// donc les vider intégralement sans risquer d'affecter un autre fichier de test.
async function cleanupOrgData() {
  await prisma.innovationCategory.deleteMany({})
  await prisma.innovationOrgUnit.deleteMany({})
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

const PLUGINS = [
  { plugin: innovationRoutes, prefix: '/api/innovation' },
  { plugin: challengeRoutes, prefix: '/api/innovation' },
  { plugin: innovationOrgRoutes, prefix: '/api/innovation' },
]

describe('Innovation Org — référentiel hybride en mode dégradé (LDAP_API_URL absente en test)', () => {
  let app: FastifyInstance
  let admin: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let directionId: string // id brut InnovationOrgUnit (interne)
  let equipeId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await cleanupOrgData()
    app = await buildTestApp(PLUGINS)
    admin = await createTestUser(app, ADMIN_EMAIL)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await cleanupOrgData()
    await app.close()
  })

  it('GET /org-units — ldapDegraded=true en l\'absence de LDAP_API_URL, aucun crash', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/org-units', headers: auth(stranger.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().ldapDegraded).toBe(true)
    expect(res.json().units).toEqual([])
  })

  it('POST /org-units — un non-admin ne peut pas créer → 403', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/org-units', headers: auth(stranger.token), payload: { nom: 'x', niveau: 'DIRECTION' } })
    expect(res.statusCode).toBe(403)
  })

  it('POST /org-units — un admin crée une unité racine', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/org-units', headers: auth(admin.token), payload: { nom: 'Direction Innovation', niveau: 'DIRECTION' } })
    expect(res.statusCode).toBe(201)
    directionId = res.json().id
  })

  it('POST /org-units — parentId inexistant → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/org-units', headers: auth(admin.token), payload: { nom: 'x', niveau: 'EQUIPE', parentId: 'ckinexistant000000000000' } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /org-units — crée une sous-unité rattachée', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/org-units', headers: auth(admin.token), payload: { nom: 'Équipe Data', niveau: 'EQUIPE', parentId: directionId } })
    expect(res.statusCode).toBe(201)
    equipeId = res.json().id
    expect(res.json().parentId).toBe(directionId)
  })

  it('GET /org-units — l\'arbre interne apparaît avec les refs préfixées int:', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/org-units', headers: auth(stranger.token) })
    const refs = res.json().units.map((u: { ref: string }) => u.ref)
    expect(refs).toContain(`int:${directionId}`)
    expect(refs).toContain(`int:${equipeId}`)
  })

  it('PATCH /org-units/:id — une unité ne peut pas être son propre parent → 400', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/org-units/${directionId}`, headers: auth(admin.token), payload: { parentId: directionId } })
    expect(res.statusCode).toBe(400)
  })

  it('PATCH /org-units/:id — rattacher un parent à son propre descendant créerait un cycle → 400', async () => {
    // directionId est déjà l'ancêtre d'equipeId ; le rattacher SOUS equipeId formerait un cycle.
    const res = await app.inject({ method: 'PATCH', url: `/api/innovation/org-units/${directionId}`, headers: auth(admin.token), payload: { parentId: equipeId } })
    expect(res.statusCode).toBe(400)
  })

  it('DELETE /org-units/:id — refuse si l\'unité a des enfants → 409', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/org-units/${directionId}`, headers: auth(admin.token) })
    expect(res.statusCode).toBe(409)
  })

  it('DELETE /org-units/:id — refuse si une fiche y est rattachée → 409', async () => {
    const fiche = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(admin.token), payload: { title: 'x', pitch: 'x', orgUnitRef: `int:${equipeId}` } })
    expect(fiche.statusCode).toBe(201)
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/org-units/${equipeId}`, headers: auth(admin.token) })
    expect(res.statusCode).toBe(409)
  })

  it('DELETE /org-units/:id — un étranger ne peut pas supprimer → 403', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/org-units/${equipeId}`, headers: auth(stranger.token) })
    expect(res.statusCode).toBe(403)
  })
})

describe('Innovation Org — catégories (globales, scopées, héritage)', () => {
  let app: FastifyInstance
  let admin: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let parentUnitId: string
  let childUnitId: string
  let siblingUnitId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await cleanupOrgData()
    app = await buildTestApp(PLUGINS)
    admin = await createTestUser(app, ADMIN_EMAIL)
    stranger = await createTestUser(app, `stranger-cat${SUFFIX}`)

    const parent = await prisma.innovationOrgUnit.create({ data: { nom: 'Direction', niveau: 'DIRECTION' } })
    parentUnitId = parent.id
    const child = await prisma.innovationOrgUnit.create({ data: { nom: 'Équipe A', niveau: 'EQUIPE', parentId: parentUnitId } })
    childUnitId = child.id
    const sibling = await prisma.innovationOrgUnit.create({ data: { nom: 'Équipe B', niveau: 'EQUIPE', parentId: parentUnitId } })
    siblingUnitId = sibling.id

    await prisma.innovationCategory.create({ data: { label: 'Globale', orgUnitRef: null } })
    await prisma.innovationCategory.create({ data: { label: 'Scopée Direction', orgUnitRef: `int:${parentUnitId}` } })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await cleanupOrgData()
    await app.close()
  })

  it('POST /categories — un non-admin ne peut pas créer → 403', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/categories', headers: auth(stranger.token), payload: { label: 'x' } })
    expect(res.statusCode).toBe(403)
  })

  it('POST /categories — orgUnitRef invalide → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/innovation/categories', headers: auth(admin.token), payload: { label: 'x', orgUnitRef: 'int:inexistant' } })
    expect(res.statusCode).toBe(400)
  })

  it('GET /categories (sans orgUnitRef) — seulement les catégories globales', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/innovation/categories', headers: auth(stranger.token) })
    const labels = res.json().map((c: { label: string }) => c.label)
    expect(labels).toContain('Globale')
    expect(labels).not.toContain('Scopée Direction')
  })

  it('GET /categories?orgUnitRef=<enfant> — hérite la catégorie de son parent + la globale', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/categories?orgUnitRef=int:${childUnitId}`, headers: auth(stranger.token) })
    const labels = res.json().map((c: { label: string }) => c.label)
    expect(labels).toContain('Globale')
    expect(labels).toContain('Scopée Direction')
  })

  it('GET /categories?orgUnitRef=<frère non descendant> — n\'hérite pas d\'une catégorie scopée à un frère', async () => {
    await prisma.innovationCategory.create({ data: { label: 'Scopée Équipe A', orgUnitRef: `int:${childUnitId}` } })
    const res = await app.inject({ method: 'GET', url: `/api/innovation/categories?orgUnitRef=int:${siblingUnitId}`, headers: auth(stranger.token) })
    const labels = res.json().map((c: { label: string }) => c.label)
    expect(labels).not.toContain('Scopée Équipe A')
    expect(labels).toContain('Scopée Direction') // toujours héritée du parent commun
  })

  it('POST /fiches — categoryId scopé à un périmètre hors du orgUnitRef fourni → 400', async () => {
    const scoped = await prisma.innovationCategory.findFirstOrThrow({ where: { label: 'Scopée Équipe A' } })
    const res = await app.inject({
      method: 'POST', url: '/api/innovation/fiches', headers: auth(admin.token),
      payload: { title: 'x', pitch: 'x', orgUnitRef: `int:${siblingUnitId}`, categoryId: scoped.id },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /fiches — categoryId applicable (héritée) au orgUnitRef fourni → 201', async () => {
    const scoped = await prisma.innovationCategory.findFirstOrThrow({ where: { label: 'Scopée Direction' } })
    const res = await app.inject({
      method: 'POST', url: '/api/innovation/fiches', headers: auth(admin.token),
      payload: { title: 'x', pitch: 'x', orgUnitRef: `int:${childUnitId}`, categoryId: scoped.id },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().category.label).toBe('Scopée Direction')
  })

  it('GET /fiches?orgUnitRef=<parent> — la fiche du sous-périmètre child apparaît (sous-arbre inclus)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches?orgUnitRef=int:${parentUnitId}`, headers: auth(admin.token) })
    expect(res.json().some((f: { orgUnitRef: string }) => f.orgUnitRef === `int:${childUnitId}`)).toBe(true)
  })

  it('GET /fiches?orgUnitRef=<frère> — la fiche du cousin n\'apparaît pas', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches?orgUnitRef=int:${siblingUnitId}`, headers: auth(admin.token) })
    expect(res.json().some((f: { orgUnitRef: string | null }) => f.orgUnitRef === `int:${childUnitId}`)).toBe(false)
  })
})

describe('Innovation Org — éligibilité des challenges par sous-arbre', () => {
  let app: FastifyInstance
  let admin: { user: { id: string }; token: string }
  let author: { user: { id: string }; token: string }
  let scopedUnitId: string
  let childUnitId: string
  let outsideUnitId: string
  let challengeId: string
  let eligibleFicheId: string
  let outsideFicheId: string
  let noOrgFicheId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await cleanupOrgData()
    app = await buildTestApp(PLUGINS)
    admin = await createTestUser(app, ADMIN_EMAIL)
    author = await createTestUser(app, `author-elig${SUFFIX}`)

    const scoped = await prisma.innovationOrgUnit.create({ data: { nom: 'Division Cible', niveau: 'DIVISION' } })
    scopedUnitId = scoped.id
    const child = await prisma.innovationOrgUnit.create({ data: { nom: 'Département Fils', niveau: 'DEPARTEMENT', parentId: scopedUnitId } })
    childUnitId = child.id
    const outside = await prisma.innovationOrgUnit.create({ data: { nom: 'Division Hors périmètre', niveau: 'DIVISION' } })
    outsideUnitId = outside.id

    const challenge = await app.inject({
      method: 'POST', url: '/api/innovation/challenges', headers: auth(admin.token),
      payload: { nom: 'Challenge scopé', description: 'x', orgUnitRef: `int:${scopedUnitId}` },
    })
    challengeId = challenge.json().id
    await app.inject({ method: 'PATCH', url: `/api/innovation/challenges/${challengeId}`, headers: auth(admin.token), payload: { status: 'OPEN' } })

    const eligible = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(author.token), payload: { title: 'Éligible', pitch: 'x', orgUnitRef: `int:${childUnitId}` } })
    eligibleFicheId = eligible.json().id
    const outsideFiche = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(author.token), payload: { title: 'Hors périmètre', pitch: 'x', orgUnitRef: `int:${outsideUnitId}` } })
    outsideFicheId = outsideFiche.json().id
    const noOrg = await app.inject({ method: 'POST', url: '/api/innovation/fiches', headers: auth(author.token), payload: { title: 'Sans périmètre', pitch: 'x' } })
    noOrgFicheId = noOrg.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await cleanupOrgData()
    await app.close()
  })

  it('une fiche dans le sous-arbre du challenge s\'inscrit avec succès', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries`, headers: auth(author.token), payload: { ficheId: eligibleFicheId } })
    expect(res.statusCode).toBe(201)
  })

  it('une fiche hors du sous-arbre du challenge est refusée → 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries`, headers: auth(author.token), payload: { ficheId: outsideFicheId } })
    expect(res.statusCode).toBe(400)
  })

  it('une fiche sans périmètre organisationnel est refusée par un challenge scopé → 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/innovation/challenges/${challengeId}/entries`, headers: auth(author.token), payload: { ficheId: noOrgFicheId } })
    expect(res.statusCode).toBe(400)
  })
})
