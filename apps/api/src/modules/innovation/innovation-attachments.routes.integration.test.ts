import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { innovationRoutes } from './innovation.routes.js'
import { innovationAttachmentsRoutes } from './innovation-attachments.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@innovation-attachments.int.test'
const ADMIN_EMAIL = 'admin@feedback.int.test'
async function cleanupAdmin() {
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } })
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('Innovation — pièces jointes', () => {
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
      { plugin: innovationAttachmentsRoutes, prefix: '/api/innovation' },
    ])
    alice = await createTestUser(app, `alice${SUFFIX}`)
    bob = await createTestUser(app, `bob${SUFFIX}`)
    admin = await createTestUser(app, ADMIN_EMAIL)

    const created = await app.inject({
      method: 'POST', url: '/api/innovation/fiches', headers: auth(alice.token),
      payload: { title: 'Fiche avec pièces jointes', pitch: 'x' },
    })
    ficheId = created.json().id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await cleanupAdmin()
    await app.close()
  })

  it('POST /fiches/:id/attachments/upload-url — un étranger ne peut pas uploader → 403', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/attachments/upload-url`, headers: auth(bob.token),
      payload: { filename: 'schema.png', mimeType: 'image/png' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST /fiches/:id/attachments/upload-url — l\'auteure obtient une URL signée', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/attachments/upload-url`, headers: auth(alice.token),
      payload: { filename: 'schema.png', mimeType: 'image/png' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().key).toMatch(/^innovation\//)
    expect(typeof res.json().uploadUrl).toBe('string')
  })

  it('POST /fiches/:id/attachments/upload-url — type MIME non autorisé → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/attachments/upload-url`, headers: auth(alice.token),
      payload: { filename: 'script.exe', mimeType: 'application/x-msdownload' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('POST /fiches/:id/attachments — enregistrement après upload', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/attachments`, headers: auth(alice.token),
      payload: { storageKey: `innovation/${ficheId}/test.png`, filename: 'schema.png', mimeType: 'image/png', sizeBytes: 1024 },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().uploader.id).toBe(alice.user.id)
  })

  it('POST /fiches/:id/attachments — un étranger ne peut pas enregistrer → 403', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/attachments`, headers: auth(bob.token),
      payload: { storageKey: `innovation/${ficheId}/pirate.png`, filename: 'pirate.png', mimeType: 'image/png', sizeBytes: 1024 },
    })
    expect(res.statusCode).toBe(403)
  })

  it('POST /fiches/:id/attachments — fichier trop volumineux → 400', async () => {
    const res = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/attachments`, headers: auth(alice.token),
      payload: { storageKey: `innovation/${ficheId}/big.png`, filename: 'big.png', mimeType: 'image/png', sizeBytes: 50 * 1024 * 1024 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('GET /fiches/:id/attachments — visible par un étranger (fiche publique)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/attachments`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(200)
    expect(res.json().length).toBeGreaterThan(0)
  })

  it('GET /attachments/:attachmentId/url — renvoie une URL signée de lecture', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/attachments`, headers: auth(alice.token) })
    const attachmentId = list.json()[0].id
    const res = await app.inject({ method: 'GET', url: `/api/innovation/attachments/${attachmentId}/url`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().url).toBe('string')
  })

  it('DELETE /attachments/:attachmentId — un étranger ne peut pas supprimer → 403', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/attachments`, headers: auth(alice.token) })
    const attachmentId = list.json()[0].id
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/attachments/${attachmentId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(403)
  })

  it('DELETE /attachments/:attachmentId — l\'auteure de la fiche peut supprimer', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/innovation/fiches/${ficheId}/attachments`, headers: auth(alice.token) })
    const attachmentId = list.json()[0].id
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/attachments/${attachmentId}`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(204)
  })

  it('DELETE /attachments/:attachmentId — un admin peut supprimer la pièce jointe d\'un tiers', async () => {
    const posted = await app.inject({
      method: 'POST', url: `/api/innovation/fiches/${ficheId}/attachments`, headers: auth(alice.token),
      payload: { storageKey: `innovation/${ficheId}/admin-test.png`, filename: 'admin-test.png', mimeType: 'image/png', sizeBytes: 512 },
    })
    const attachmentId = posted.json().id
    const res = await app.inject({ method: 'DELETE', url: `/api/innovation/attachments/${attachmentId}`, headers: auth(admin.token) })
    expect(res.statusCode).toBe(204)
  })
})
