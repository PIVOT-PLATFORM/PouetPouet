import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { parcoursRoutes } from './parcours.routes.js'

// Accès des intervenants : une personne assignée, membre d'un groupe ou
// approbatrice lit l'instance et agit sur SES étapes sans partage explicite.
const SUFFIX = '@parcours-intervenants.int.test'

type TestUser = { user: { id: string }; token: string }

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

async function startInstance(app: FastifyInstance, owner: TestUser, steps: Record<string, unknown>[]) {
  const tmpl = await app.inject({ method: 'POST', url: '/api/parcours/templates', headers: auth(owner.token), payload: { name: 'Intervenants', steps } })
  const inst = await app.inject({ method: 'POST', url: '/api/parcours/instances', headers: auth(owner.token), payload: { templateId: tmpl.json().id, title: 'Projet' } })
  return inst.json().id as string
}

describe('intervenants — assigné à une étape suivante (mode user)', () => {
  let app: FastifyInstance
  let owner: TestUser
  let valideur: TestUser
  let outsider: TestUser
  let instanceId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: parcoursRoutes, prefix: '/api/parcours' }])
    owner = await createTestUser(app, `owner-user${SUFFIX}`)
    valideur = await createTestUser(app, `valideur-user${SUFFIX}`)
    outsider = await createTestUser(app, `outsider-user${SUFFIX}`)
    instanceId = await startInstance(app, owner, [
      { type: 'info', title: 'Cadrage' },
      { type: 'validation', assignmentMode: 'user', title: 'Go / No-go', assignedTo: valideur.user.id },
      { type: 'info', title: 'Exécution' },
    ])
  })
  afterAll(async () => { await cleanupUsers(SUFFIX); await app.close() })

  it('avant activation de son étape, le valideur n\'a pas accès', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/parcours/instances/${instanceId}`, headers: auth(valideur.token) })
    expect(res.statusCode).toBe(403)
  })

  it('une fois l\'étape activée, il voit l\'instance dans sa liste et son détail', async () => {
    const done = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/0`, headers: auth(owner.token), payload: { action: 'complete' } })
    expect(done.statusCode).toBe(200)

    const list = await app.inject({ method: 'GET', url: '/api/parcours/instances', headers: auth(valideur.token) })
    expect(list.json().map((i: { id: string }) => i.id)).toContain(instanceId)

    const detail = await app.inject({ method: 'GET', url: `/api/parcours/instances/${instanceId}`, headers: auth(valideur.token) })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().role).toBe('VIEWER')
    expect(detail.json().actionableSteps).toEqual([1])
  })

  it('un tiers reste sans accès', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/parcours/instances/${instanceId}`, headers: auth(outsider.token) })
    expect(res.statusCode).toBe(403)
  })

  it('l\'intervenant ne peut ni forcer ni passer une étape (droits d\'édition)', async () => {
    const force = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/2/force-complete`, headers: auth(valideur.token), payload: {} })
    expect(force.statusCode).toBe(403)
    const skip = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/1/skip`, headers: auth(valideur.token), payload: {} })
    expect(skip.statusCode).toBe(403)
  })

  it('il dépose un document uniquement sur son étape en attente', async () => {
    const url = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/documents/upload-url`, headers: auth(valideur.token), payload: { filename: 'avis.pdf', mimeType: 'application/pdf' } })
    expect(url.statusCode).toBe(200)
    const key = url.json().key as string

    const doc = { storageKey: key, filename: 'avis.pdf', mimeType: 'application/pdf', sizeBytes: 10 }
    const wrongStep = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/documents`, headers: auth(valideur.token), payload: { ...doc, stepIndex: 2 } })
    expect(wrongStep.statusCode).toBe(403)
    const ownStep = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/documents`, headers: auth(valideur.token), payload: { ...doc, stepIndex: 1 } })
    expect(ownStep.statusCode).toBe(201)
  })

  it('il valide son étape → l\'instance avance, puis il garde la lecture sans action', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/1`, headers: auth(valideur.token), payload: { action: 'complete', comment: 'Go' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().nextStep).toBe(2)

    const detail = await app.inject({ method: 'GET', url: `/api/parcours/instances/${instanceId}`, headers: auth(valideur.token) })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().actionableSteps).toEqual([])

    const again = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/2`, headers: auth(valideur.token), payload: { action: 'complete' } })
    expect(again.statusCode).toBe(403)
  })
})

describe('intervenants — groupe et chaîne d\'approbation en première étape', () => {
  let app: FastifyInstance
  let owner: TestUser
  let membre: TestUser
  let approver1: TestUser
  let approver2: TestUser
  let outsider: TestUser

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: parcoursRoutes, prefix: '/api/parcours' }])
    owner = await createTestUser(app, `owner-grp${SUFFIX}`)
    membre = await createTestUser(app, `membre-grp${SUFFIX}`)
    approver1 = await createTestUser(app, `app1-grp${SUFFIX}`)
    approver2 = await createTestUser(app, `app2-grp${SUFFIX}`)
    outsider = await createTestUser(app, `outsider-grp${SUFFIX}`)
  })
  afterAll(async () => { await cleanupUsers(SUFFIX); await app.close() })

  it('un membre du groupe valide sans partage ; un non-membre est refusé', async () => {
    const instanceId = await startInstance(app, owner, [
      { type: 'validation', assignmentMode: 'group', title: 'Revue équipe', groupMembers: [{ id: membre.user.id }] },
      { type: 'info', title: 'Fin' },
    ])
    const denied = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/0`, headers: auth(outsider.token), payload: { action: 'complete' } })
    expect(denied.statusCode).toBe(403)

    const ok = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/0`, headers: auth(membre.token), payload: { action: 'complete' } })
    expect(ok.statusCode).toBe(200)
  })

  it('les approbateurs accèdent à l\'instance et l\'ordre de la chaîne est respecté', async () => {
    const instanceId = await startInstance(app, owner, [
      { type: 'approval-chain', title: 'Comité', approvers: [approver1.user.id, approver2.user.id], requireAll: true },
      { type: 'info', title: 'Fin' },
    ])
    const detail = await app.inject({ method: 'GET', url: `/api/parcours/instances/${instanceId}`, headers: auth(approver2.token) })
    expect(detail.statusCode).toBe(200)

    const tooEarly = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/0`, headers: auth(approver2.token), payload: { action: 'complete' } })
    expect(tooEarly.statusCode).toBe(403)

    const first = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/0`, headers: auth(approver1.token), payload: { action: 'complete' } })
    expect(first.statusCode).toBe(200)
    expect(first.json().chainPending).toBe(true)

    const second = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/0`, headers: auth(approver2.token), payload: { action: 'complete' } })
    expect(second.statusCode).toBe(200)
    expect(second.json().nextStep).toBe(1)
  })
})
