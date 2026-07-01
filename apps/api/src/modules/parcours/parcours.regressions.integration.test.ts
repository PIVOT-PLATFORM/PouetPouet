import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { parcoursRoutes } from './parcours.routes.js'
import { prisma } from '../../lib/prisma.js'

// Régressions issues de la code review (findings corrigés).
const SUFFIX = '@parcours-regressions.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

async function createTemplate(app: FastifyInstance, token: string, payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/api/parcours/templates', headers: auth(token), payload })
}

// ── Déclencheur cron désactivé (« pas encore disponible ») ────────────────────

describe('Régression — déclencheur schedule/cron refusé', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: parcoursRoutes, prefix: '/api/parcours' }])
    owner = await createTestUser(app, `owner-cron${SUFFIX}`)
  })
  afterAll(async () => { await cleanupUsers(SUFFIX); await app.close() })

  it('POST /templates avec triggerType=schedule → 400', async () => {
    const res = await createTemplate(app, owner.token, { name: 'Cron', steps: [{ type: 'info', title: 'A' }], triggerType: 'schedule' })
    expect(res.statusCode).toBe(400)
  })

  it('les autres triggers restent acceptés (manual/webhook/form_response)', async () => {
    for (const triggerType of ['manual', 'webhook', 'form_response']) {
      const res = await createTemplate(app, owner.token, { name: `T-${triggerType}`, steps: [{ type: 'info', title: 'A' }], triggerType })
      expect(res.statusCode).toBe(201)
    }
  })
})

// ── Verrou optimiste : double complétion concurrente ─────────────────────────

describe('Régression — complétion concurrente d\'une étape (verrou optimiste)', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let instanceId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: parcoursRoutes, prefix: '/api/parcours' }])
    owner = await createTestUser(app, `owner-race${SUFFIX}`)
    const tmpl = await createTemplate(app, owner.token, {
      name: 'Race', steps: [{ type: 'info', title: 'A' }, { type: 'info', title: 'B' }],
    })
    const inst = await app.inject({ method: 'POST', url: '/api/parcours/instances', headers: auth(owner.token), payload: { templateId: tmpl.json().id, title: 'Race run' } })
    instanceId = inst.json().id
  })
  afterAll(async () => { await cleanupUsers(SUFFIX); await app.close() })

  it('deux complétions simultanées de l\'étape 0 → exactement une réussit (200), l\'autre 409', async () => {
    const complete = () => app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/0`, headers: auth(owner.token), payload: { action: 'complete' } })
    const [a, b] = await Promise.all([complete(), complete()])
    const codes = [a.statusCode, b.statusCode].sort()
    expect(codes).toEqual([200, 409])
  })
})

// ── Webhook : activation de la première étape (helper partagé) ────────────────

describe('Régression — webhook active la première étape (assignation + notif)', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let assignee: { user: { id: string }; token: string }
  let webhookToken: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: parcoursRoutes, prefix: '/api/parcours' }])
    owner = await createTestUser(app, `owner-wh${SUFFIX}`)
    assignee = await createTestUser(app, `assignee-wh${SUFFIX}`)
    const tmpl = await createTemplate(app, owner.token, {
      name: 'WH activation',
      steps: [
        { type: 'validation', assignmentMode: 'user', title: 'Valider', assignedTo: assignee.user.id, slaDays: 2 },
        { type: 'info', title: 'Fin' },
      ],
      triggerType: 'webhook',
    })
    const gen = await app.inject({ method: 'POST', url: `/api/parcours/templates/${tmpl.json().id}/webhook/generate`, headers: auth(owner.token) })
    webhookToken = gen.json().webhookToken
  })
  afterAll(async () => { await cleanupUsers(SUFFIX); await app.close() })

  it('POST /webhooks/:token → instance créée, étape 0 assignée + due + notifiée', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/parcours/webhooks/${webhookToken}`, payload: { title: 'Depuis webhook' } })
    expect(res.statusCode).toBe(201)
    const instanceId = res.json().instanceId

    const step0 = await prisma.parcourStepInstance.findUnique({ where: { instanceId_stepIndex: { instanceId, stepIndex: 0 } } })
    expect(step0!.assignedTo).toBe(assignee.user.id)
    expect(step0!.dueAt).not.toBeNull()

    // activateFirstStep doit avoir notifié l'assigné (régression : le webhook ne le faisait pas).
    const notif = await prisma.notification.findFirst({ where: { userId: assignee.user.id, type: 'PARCOURS_STEP_ASSIGNED' } })
    expect(notif).not.toBeNull()
  })
})

// ── Payload de déclencheur agrégé dans les conditions ────────────────────────

describe('Régression — instance.data (payload webhook) résout les conditions skipIf', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let webhookToken: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: parcoursRoutes, prefix: '/api/parcours' }])
    owner = await createTestUser(app, `owner-payload${SUFFIX}`)
    const tmpl = await createTemplate(app, owner.token, {
      name: 'Payload skipIf',
      steps: [
        { type: 'info', title: 'Entrée' },
        { type: 'info', title: 'Grosse dépense', skipIf: { field: 'montant', operator: 'gt', value: '1000' } },
      ],
      triggerType: 'webhook',
    })
    const gen = await app.inject({ method: 'POST', url: `/api/parcours/templates/${tmpl.json().id}/webhook/generate`, headers: auth(owner.token) })
    webhookToken = gen.json().webhookToken
  })
  afterAll(async () => { await cleanupUsers(SUFFIX); await app.close() })

  it('montant=5000 dans le payload → étape 1 SKIPPED à la complétion de l\'étape 0', async () => {
    const wh = await app.inject({ method: 'POST', url: `/api/parcours/webhooks/${webhookToken}`, payload: { data: { montant: 5000 } } })
    const instanceId = wh.json().instanceId

    const done = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/0`, headers: auth(owner.token), payload: { action: 'complete' } })
    expect(done.statusCode).toBe(200)

    const step1 = await prisma.parcourStepInstance.findUnique({ where: { instanceId_stepIndex: { instanceId, stepIndex: 1 } } })
    expect(step1!.status).toBe('SKIPPED')
  })
})

// ── Audit trail _chain préservé à l'approbation finale ───────────────────────

describe('Régression — audit _chain préservé après approbation finale', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let approver1: { user: { id: string }; token: string }
  let approver2: { user: { id: string }; token: string }
  let instanceId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: parcoursRoutes, prefix: '/api/parcours' }])
    owner = await createTestUser(app, `owner-chain${SUFFIX}`)
    approver1 = await createTestUser(app, `app1-chain${SUFFIX}`)
    approver2 = await createTestUser(app, `app2-chain${SUFFIX}`)

    const tmpl = await createTemplate(app, owner.token, {
      name: 'Chain audit',
      steps: [
        { type: 'approval-chain', title: 'Double validation', approvers: [approver1.user.id, approver2.user.id], requireAll: true },
        { type: 'info', title: 'Fin' },
      ],
    })
    const inst = await app.inject({ method: 'POST', url: '/api/parcours/instances', headers: auth(owner.token), payload: { templateId: tmpl.json().id, title: 'Chain run' } })
    instanceId = inst.json().id

    // Init de la chaîne + partage EDITOR (comme la suite approval-chain existante).
    await prisma.parcourStepInstance.update({
      where: { instanceId_stepIndex: { instanceId, stepIndex: 0 } },
      data: { assignedTo: approver1.user.id, data: { _chain: { approvals: [], currentApproverIndex: 0 } } },
    })
    await prisma.moduleShare.createMany({
      data: [
        { module: 'parcourInstance', resourceId: instanceId, userId: approver1.user.id, role: 'EDITOR' },
        { module: 'parcourInstance', resourceId: instanceId, userId: approver2.user.id, role: 'EDITOR' },
      ],
    })
  })
  afterAll(async () => { await cleanupUsers(SUFFIX); await app.close() })

  it('après approbation des deux approbateurs → étape COMPLETED ET _chain conserve les 2 décisions', async () => {
    await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/0`, headers: auth(approver1.token), payload: { action: 'complete', comment: 'ok1' } })
    const final = await app.inject({ method: 'POST', url: `/api/parcours/instances/${instanceId}/steps/0`, headers: auth(approver2.token), payload: { action: 'complete', comment: 'ok2' } })
    expect(final.statusCode).toBe(200)

    const step0 = await prisma.parcourStepInstance.findUnique({ where: { instanceId_stepIndex: { instanceId, stepIndex: 0 } } })
    expect(step0!.status).toBe('COMPLETED')
    const data = step0!.data as { _chain?: { approvals?: unknown[] } } | null
    expect(data?._chain?.approvals).toHaveLength(2)
  })
})
