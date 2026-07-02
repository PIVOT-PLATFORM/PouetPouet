import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { formsRoutes } from './forms.routes.js'
import { parcoursRoutes } from '../parcours/parcours.routes.js'
import { prisma } from '../../lib/prisma.js'
import { bus } from '../../lib/bus.js'

const SUFFIX = '@forms-bus.int.test'

// ── Soumission de réponse publie sur le bus ───────────────────────────────────

describe('soumission de réponse publie sur le bus', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let formId: string
  let publicToken: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: formsRoutes, prefix: '/api/forms' },
      { plugin: parcoursRoutes, prefix: '/api/parcours' },
    ])
    owner = await createTestUser(app, `owner-forms${SUFFIX}`)

    // Créer un formulaire
    const created = await app.inject({
      method: 'POST',
      url: '/api/forms',
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Mon formulaire bus' },
    })
    expect(created.statusCode).toBe(201)
    formId = created.json().id

    // Publier le formulaire
    const published = await app.inject({
      method: 'PATCH',
      url: `/api/forms/${formId}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { isPublished: true },
    })
    expect(published.statusCode).toBe(200)
    publicToken = published.json().publicToken
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('POST /public/:token/responses publie l\'événement form.response.created', async () => {
    const events: unknown[] = []
    const unsub = bus.subscribe('form.response.created', (event) => {
      events.push(event)
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/forms/public/${publicToken}/responses`,
      payload: { data: {} },
    })
    expect(res.statusCode).toBe(201)

    unsub()

    expect(events.length).toBe(1)
    const event = events[0] as { payload: { formId: string; responseId: string } }
    expect(event.payload.formId).toBe(formId)
    expect(event.payload.responseId).toBe(res.json().id)
  })
})

// ── Bus trigger crée une instance parcours ────────────────────────────────────

describe('bus trigger crée une instance parcours', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let formId: string
  let publicToken: string
  let templateId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: formsRoutes, prefix: '/api/forms' },
      { plugin: parcoursRoutes, prefix: '/api/parcours' },
    ])
    owner = await createTestUser(app, `owner-bus-forms${SUFFIX}`)

    // Créer et publier un formulaire
    const created = await app.inject({
      method: 'POST',
      url: '/api/forms',
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { title: 'Formulaire trigger parcours' },
    })
    formId = created.json().id

    const published = await app.inject({
      method: 'PATCH',
      url: `/api/forms/${formId}`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { isPublished: true },
    })
    publicToken = published.json().publicToken

    // Créer un template parcours avec triggerType=form_response et le formId
    const tmpl = await app.inject({
      method: 'POST',
      url: '/api/parcours/templates',
      headers: { authorization: `Bearer ${owner.token}` },
      payload: {
        name: 'Template déclenché par formulaire',
        steps: [{ type: 'info', title: 'Étape auto' }],
        triggerType: 'form_response',
        triggerConfig: { formId },
      },
    })
    templateId = tmpl.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('soumettre une réponse crée automatiquement une instance parcours', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/forms/public/${publicToken}/responses`,
      payload: { data: {} },
    })
    expect(res.statusCode).toBe(201)

    // Laisser les handlers async s'exécuter
    await new Promise((r) => setTimeout(r, 50))

    const instances = await prisma.parcourInstance.findMany({ where: { templateId } })
    expect(instances.length).toBeGreaterThanOrEqual(1)
    expect(instances[0].ownerId).toBe(owner.user.id)
  })
})
