import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { pdfRoutes } from './pdf.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@pdf.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

// Même calcul que pdf.routes.ts (UPLOAD_DIR / filePath) — pas exporté, on le
// duplique volontairement pour écrire les fichiers de test au bon endroit.
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? './uploads/pdfs')
function filePath(id: string) {
  return path.join(UPLOAD_DIR, `${id}.pdf`)
}

async function makePdfBytes(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) doc.addPage([200, 200])
  return Buffer.from(await doc.save())
}

// Seed direct en base + fichier sur disque (contourne l'upload multipart — même
// convention que signdoc.integration.test.ts pour les tests de manipulation).
async function seedDoc(ownerId: string, opts: { name?: string; pageCount?: number; folderId?: string | null } = {}) {
  const pageCount = opts.pageCount ?? 1
  const bytes = await makePdfBytes(pageCount)
  const record = await prisma.pdfDocument.create({
    data: { ownerId, name: opts.name ?? 'Doc', pageCount, size: bytes.length, folderId: opts.folderId ?? null, tags: [] },
  })
  mkdirSync(UPLOAD_DIR, { recursive: true })
  writeFileSync(filePath(record.id), bytes)
  return record
}

describe('PDF — documents, manipulation, dossiers', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let bob: { user: { id: string }; token: string }

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: pdfRoutes, prefix: '/api/pdf' }])
    alice = await createTestUser(app, `alice${SUFFIX}`)
    bob = await createTestUser(app, `bob${SUFFIX}`)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('GET /capabilities → 200 avec un booléen pandoc', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pdf/capabilities', headers: auth(alice.token) })
    expect(res.statusCode).toBe(200)
    expect(typeof res.json().pandoc).toBe('boolean')
  })

  it('GET / ne liste que les documents du propriétaire, avec sizeLabel', async () => {
    const doc = await seedDoc(alice.user.id, { name: 'Alice Doc' })
    const asAlice = await app.inject({ method: 'GET', url: '/api/pdf', headers: auth(alice.token) })
    const asBob = await app.inject({ method: 'GET', url: '/api/pdf', headers: auth(bob.token) })
    const mine = asAlice.json().find((d: { id: string }) => d.id === doc.id)
    expect(mine.sizeLabel).toMatch(/o$/)
    expect(asBob.json().some((d: { id: string }) => d.id === doc.id)).toBe(false)
  })

  it('GET /:id — un tiers ne peut pas voir le document d\'un autre → 404', async () => {
    const doc = await seedDoc(alice.user.id)
    const res = await app.inject({ method: 'GET', url: `/api/pdf/${doc.id}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(404)
  })

  it('GET /:id/file — sert le PDF avec les bons en-têtes', async () => {
    const doc = await seedDoc(alice.user.id, { name: 'Rapport' })
    const res = await app.inject({ method: 'GET', url: `/api/pdf/${doc.id}/file`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/pdf')
    expect(res.headers['content-disposition']).toContain('Rapport')
  })

  it('GET /:id/file — un tiers ne peut pas accéder au fichier → 404', async () => {
    const doc = await seedDoc(alice.user.id)
    const res = await app.inject({ method: 'GET', url: `/api/pdf/${doc.id}/file`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(404)
  })

  it('GET /:id/text — extrait le texte (chaîne, même vide sur un PDF sans contenu)', async () => {
    const doc = await seedDoc(alice.user.id)
    const res = await app.inject({ method: 'GET', url: `/api/pdf/${doc.id}/text`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(200)
    expect(typeof res.body).toBe('string')
  })

  it('PATCH /:id — un tiers ne peut pas renommer → 404', async () => {
    const doc = await seedDoc(alice.user.id)
    const res = await app.inject({ method: 'PATCH', url: `/api/pdf/${doc.id}`, headers: auth(bob.token), payload: { name: 'pirate' } })
    expect(res.statusCode).toBe(404)
  })

  it('PATCH /:id — le propriétaire renomme et tague', async () => {
    const doc = await seedDoc(alice.user.id)
    const res = await app.inject({ method: 'PATCH', url: `/api/pdf/${doc.id}`, headers: auth(alice.token), payload: { name: 'Renommé', tags: ['contrat', '2026'] } })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Renommé')
    expect(res.json().tags).toEqual(['contrat', '2026'])
  })

  it('PATCH /:id — payload invalide (nom vide) → 400', async () => {
    const doc = await seedDoc(alice.user.id)
    const res = await app.inject({ method: 'PATCH', url: `/api/pdf/${doc.id}`, headers: auth(alice.token), payload: { name: '' } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /merge — fusionne plusieurs documents en un nouveau', async () => {
    const a = await seedDoc(alice.user.id, { pageCount: 2 })
    const b = await seedDoc(alice.user.id, { pageCount: 3 })
    const res = await app.inject({ method: 'POST', url: '/api/pdf/merge', headers: auth(alice.token), payload: { ids: [a.id, b.id], name: 'Fusion' } })
    expect(res.statusCode).toBe(201)
    expect(res.json().pageCount).toBe(5)
    expect(existsSync(filePath(res.json().id))).toBe(true)
  })

  it('POST /merge — un document appartenant à un tiers → 404', async () => {
    const mine = await seedDoc(alice.user.id, { pageCount: 1 })
    const bobsDoc = await seedDoc(bob.user.id, { pageCount: 1 })
    const res = await app.inject({ method: 'POST', url: '/api/pdf/merge', headers: auth(alice.token), payload: { ids: [mine.id, bobsDoc.id], name: 'Fusion' } })
    expect(res.statusCode).toBe(404)
  })

  it('POST /:id/extract — extrait un sous-ensemble de pages dans un nouveau document', async () => {
    const doc = await seedDoc(alice.user.id, { pageCount: 5 })
    const res = await app.inject({ method: 'POST', url: `/api/pdf/${doc.id}/extract`, headers: auth(alice.token), payload: { pages: [0, 2, 4], name: 'Extrait' } })
    expect(res.statusCode).toBe(201)
    expect(res.json().pageCount).toBe(3)
  })

  it('POST /:id/extract — aucune page valide → 400', async () => {
    const doc = await seedDoc(alice.user.id, { pageCount: 2 })
    const res = await app.inject({ method: 'POST', url: `/api/pdf/${doc.id}/extract`, headers: auth(alice.token), payload: { pages: [50], name: 'Extrait' } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /:id/split — découpe aux frontières demandées', async () => {
    const doc = await seedDoc(alice.user.id, { pageCount: 6 })
    const res = await app.inject({ method: 'POST', url: `/api/pdf/${doc.id}/split`, headers: auth(alice.token), payload: { splitAt: [2, 4] } })
    expect(res.statusCode).toBe(201)
    const parts = res.json()
    expect(parts.map((p: { pageCount: number }) => p.pageCount)).toEqual([2, 2, 2])
  })

  it('POST /:id/rotate — tourne les pages demandées et persiste', async () => {
    const doc = await seedDoc(alice.user.id, { pageCount: 1 })
    const res = await app.inject({ method: 'POST', url: `/api/pdf/${doc.id}/rotate`, headers: auth(alice.token), payload: { pages: [0], deg: 90 } })
    expect(res.statusCode).toBe(200)
    const saved = await PDFDocument.load(new Uint8Array(readFileSync(filePath(doc.id))))
    expect(saved.getPage(0).getRotation().angle).toBe(90)
  })

  it('POST /:id/rotate — degré non autorisé → 400', async () => {
    const doc = await seedDoc(alice.user.id, { pageCount: 1 })
    const res = await app.inject({ method: 'POST', url: `/api/pdf/${doc.id}/rotate`, headers: auth(alice.token), payload: { pages: [0], deg: 45 } })
    expect(res.statusCode).toBe(400)
  })

  it('POST /:id/duplicate — crée une copie indépendante', async () => {
    const doc = await seedDoc(alice.user.id, { name: 'Original', pageCount: 2 })
    const res = await app.inject({ method: 'POST', url: `/api/pdf/${doc.id}/duplicate`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(201)
    expect(res.json().id).not.toBe(doc.id)
    expect(res.json().name).toBe('Original (copie)')
    expect(res.json().pageCount).toBe(2)
  })

  it('DELETE /:id — un tiers ne peut pas supprimer → 404 ; le propriétaire → 204', async () => {
    const doc = await seedDoc(alice.user.id)
    const denied = await app.inject({ method: 'DELETE', url: `/api/pdf/${doc.id}`, headers: auth(bob.token) })
    expect(denied.statusCode).toBe(404)
    const ok = await app.inject({ method: 'DELETE', url: `/api/pdf/${doc.id}`, headers: auth(alice.token) })
    expect(ok.statusCode).toBe(204)
    expect(existsSync(filePath(doc.id))).toBe(false)
  })

  describe('Dossiers', () => {
    it('POST /folders crée un dossier ; parent inexistant → 404', async () => {
      const bad = await app.inject({ method: 'POST', url: '/api/pdf/folders', headers: auth(alice.token), payload: { name: 'Sous-dossier', parentId: 'inexistant' } })
      expect(bad.statusCode).toBe(404)

      const res = await app.inject({ method: 'POST', url: '/api/pdf/folders', headers: auth(alice.token), payload: { name: 'Contrats' } })
      expect(res.statusCode).toBe(201)
    })

    it('PATCH /folders/:fid — un tiers ne peut pas renommer → 404', async () => {
      const folder = await prisma.pdfFolder.create({ data: { ownerId: alice.user.id, name: 'Privé' } })
      const res = await app.inject({ method: 'PATCH', url: `/api/pdf/folders/${folder.id}`, headers: auth(bob.token), payload: { name: 'pirate' } })
      expect(res.statusCode).toBe(404)
    })

    it('PATCH /folders/:fid/move — un dossier ne peut pas être son propre parent → 400', async () => {
      const folder = await prisma.pdfFolder.create({ data: { ownerId: alice.user.id, name: 'Racine' } })
      const res = await app.inject({ method: 'PATCH', url: `/api/pdf/folders/${folder.id}/move`, headers: auth(alice.token), payload: { parentId: folder.id } })
      expect(res.statusCode).toBe(400)
    })

    it('DELETE /folders/:fid — supprime le dossier, les documents retombent à la racine', async () => {
      const folder = await prisma.pdfFolder.create({ data: { ownerId: alice.user.id, name: 'À supprimer' } })
      const doc = await seedDoc(alice.user.id, { folderId: folder.id })
      const res = await app.inject({ method: 'DELETE', url: `/api/pdf/folders/${folder.id}`, headers: auth(alice.token) })
      expect(res.statusCode).toBe(204)
      const updated = await prisma.pdfDocument.findUnique({ where: { id: doc.id } })
      expect(updated?.folderId).toBeNull()
    })
  })
})
