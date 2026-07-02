import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { formsRoutes } from './forms.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@forms-api.int.test'

async function createForm(app: FastifyInstance, token: string, payload: Record<string, unknown>) {
  const res = await app.inject({ method: 'POST', url: '/api/forms', headers: { authorization: `Bearer ${token}` }, payload })
  return res
}

async function publish(app: FastifyInstance, token: string, id: string, extra: Record<string, unknown> = {}) {
  return app.inject({ method: 'PATCH', url: `/api/forms/${id}`, headers: { authorization: `Bearer ${token}` }, payload: { isPublished: true, ...extra } })
}

// ── CRUD & permissions ─────────────────────────────────────────────────────────

describe('Forms — CRUD & permissions', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let editor: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let formId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: formsRoutes, prefix: '/api/forms' }])
    owner = await createTestUser(app, `owner${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('POST / crée un formulaire → 201, role OWNER, publicToken généré', async () => {
    const res = await createForm(app, owner.token, { title: 'Sondage', fields: [{ id: 'q1', label: 'Nom', type: 'short_text', required: true }] })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    formId = body.id
    expect(body.role).toBe('OWNER')
    expect(body.publicToken).toBeTruthy()
    expect(body.fields).toHaveLength(1)
  })

  it('GET /:id — le propriétaire voit le détail', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/forms/${formId}`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Sondage')
  })

  it('GET /:id — un tiers sans partage → 403', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/forms/${formId}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(res.statusCode).toBe(403)
  })

  it('PATCH /:id — un EDITOR partagé peut éditer', async () => {
    await prisma.moduleShare.create({ data: { module: 'form', resourceId: formId, userId: editor.user.id, role: 'EDITOR' } })
    const res = await app.inject({ method: 'PATCH', url: `/api/forms/${formId}`, headers: { authorization: `Bearer ${editor.token}` }, payload: { title: 'Sondage édité' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Sondage édité')
  })

  it('PATCH /:id — un VIEWER partagé → 403', async () => {
    const viewer = await createTestUser(app, `viewer${SUFFIX}`)
    await prisma.moduleShare.create({ data: { module: 'form', resourceId: formId, userId: viewer.user.id, role: 'VIEWER' } })
    const res = await app.inject({ method: 'PATCH', url: `/api/forms/${formId}`, headers: { authorization: `Bearer ${viewer.token}` }, payload: { title: 'x' } })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /:id — un EDITOR ne peut pas supprimer (403), seul le propriétaire (204)', async () => {
    const shared = await app.inject({ method: 'DELETE', url: `/api/forms/${formId}`, headers: { authorization: `Bearer ${editor.token}` } })
    expect(shared.statusCode).toBe(403)
    const byOwner = await app.inject({ method: 'DELETE', url: `/api/forms/${formId}`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(byOwner.statusCode).toBe(204)
  })
})

// ── Remplissage public ───────────────────────────────────────────────────────

describe('Forms — remplissage public', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let formId: string
  let token: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: formsRoutes, prefix: '/api/forms' }])
    owner = await createTestUser(app, `owner-public${SUFFIX}`)
    const created = await createForm(app, owner.token, {
      title: 'Contact',
      fields: [
        { id: 'nom', label: 'Nom', type: 'short_text', required: true },
        { id: 'age', label: 'Âge', type: 'number', required: false, min: 0, max: 120 },
      ],
    })
    formId = created.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('GET /public/:token sur brouillon → 404 not_published SANS email du propriétaire (RGPD)', async () => {
    const published = await publish(app, owner.token, formId)
    token = published.json().publicToken
    // Repasser en brouillon pour tester la fuite d'info
    await app.inject({ method: 'PATCH', url: `/api/forms/${formId}`, headers: { authorization: `Bearer ${owner.token}` }, payload: { isPublished: false } })

    const res = await app.inject({ method: 'GET', url: `/api/forms/public/${token}` })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.reason).toBe('not_published')
    expect(body.ownerEmail).toBeUndefined()
  })

  it('GET /public/:token publié → accepte les réponses, sans email propriétaire', async () => {
    await publish(app, owner.token, formId)
    const res = await app.inject({ method: 'GET', url: `/api/forms/public/${token}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.acceptingResponses).toBe(true)
    expect(body.ownerEmail).toBeUndefined()
    expect(body.fields).toHaveLength(2)
  })

  it('POST /public/:token/responses — champ requis manquant → 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/forms/public/${token}/responses`, payload: { data: { age: 30 } } })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('Nom')
  })

  it('POST /public/:token/responses — nombre hors bornes → 400', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/forms/public/${token}/responses`, payload: { data: { nom: 'Bob', age: 999 } } })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('Âge')
  })

  it('POST /public/:token/responses — réponse valide → 201 et persistée', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/forms/public/${token}/responses`, payload: { data: { nom: 'Bob', age: 42 } } })
    expect(res.statusCode).toBe(201)
    const count = await prisma.formResponse.count({ where: { formId } })
    expect(count).toBe(1)
  })
})

// ── Fermeture & gating (régressions code review) ─────────────────────────────

describe('Forms — fermeture & gating', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let formId: string
  let token: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: formsRoutes, prefix: '/api/forms' }])
    owner = await createTestUser(app, `owner-close${SUFFIX}`)
    const created = await createForm(app, owner.token, { title: 'Fermable', fields: [{ id: 'q', label: 'Q', type: 'short_text', required: false }] })
    formId = created.json().id
    token = (await publish(app, owner.token, formId)).json().publicToken
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('formulaire fermé manuellement → soumission de réponse refusée (403)', async () => {
    await app.inject({ method: 'PATCH', url: `/api/forms/${formId}`, headers: { authorization: `Bearer ${owner.token}` }, payload: { acceptingResponses: false } })
    const res = await app.inject({ method: 'POST', url: `/api/forms/public/${token}/responses`, payload: { data: { q: 'x' } } })
    expect(res.statusCode).toBe(403)
  })

  it('formulaire fermé → upload de fichier refusé (403) — régression: pas seulement isPublished', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/forms/public/${token}/upload`,
      headers: { 'content-type': 'application/octet-stream', 'x-filename': 'doc.txt' },
      payload: Buffer.from('contenu'),
    })
    expect(res.statusCode).toBe(403)
  })

  it('réouvert + upload valide → 201 avec une clé préfixée forms/<id>/', async () => {
    await app.inject({ method: 'PATCH', url: `/api/forms/${formId}`, headers: { authorization: `Bearer ${owner.token}` }, payload: { acceptingResponses: true } })
    const res = await app.inject({
      method: 'POST',
      url: `/api/forms/public/${token}/upload`,
      headers: { 'content-type': 'application/octet-stream', 'x-filename': 'doc.txt' },
      payload: Buffer.from('contenu'),
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().key.startsWith(`forms/${formId}/`)).toBe(true)
  })

  it('plafond de réponses atteint → réponse refusée (403)', async () => {
    await app.inject({ method: 'PATCH', url: `/api/forms/${formId}`, headers: { authorization: `Bearer ${owner.token}` }, payload: { maxResponses: 1 } })
    const first = await app.inject({ method: 'POST', url: `/api/forms/public/${token}/responses`, payload: { data: { q: 'a' } } })
    expect(first.statusCode).toBe(201)
    const second = await app.inject({ method: 'POST', url: `/api/forms/public/${token}/responses`, payload: { data: { q: 'b' } } })
    expect(second.statusCode).toBe(403)
  })
})

// ── Téléchargement de fichier : garde d'appartenance ─────────────────────────

describe('Forms — téléchargement fichier (garde de clé)', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let formId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: formsRoutes, prefix: '/api/forms' }])
    owner = await createTestUser(app, `owner-file${SUFFIX}`)
    formId = (await createForm(app, owner.token, { title: 'Fichiers' })).json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('clé n\'appartenant pas au formulaire → 403', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/forms/${formId}/files/forms/autre-form/secret.png`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(res.statusCode).toBe(403)
  })

  it('fichier inexistant appartenant au formulaire → 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/forms/${formId}/files/forms/${formId}/inconnu.png`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(res.statusCode).toBe(404)
  })
})
