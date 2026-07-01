import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { PDFDocument } from 'pdf-lib'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { signdocRoutes } from './signdoc.routes.js'
import { finalizeEnvelope } from './signdoc.finalize.js'
import { recordEvent, verifyChain } from './signdoc.events.js'
import { deleteEnvelopeFiles, readSealed, sealedExists, sha256, writeOriginal } from './signdoc.storage.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@signdoc-seal.int.test'
// PNG transparent 1×1 (valeur de champ signature factice mais valide).
const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

async function makePdfBytes(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.addPage([400, 300]).drawText('Contrat de test', { x: 40, y: 200 })
  return Buffer.from(await doc.save())
}

describe('signdoc — scellage PAdES + vérification (integration)', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  const created: string[] = []

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: signdocRoutes, prefix: '/api/signdoc' }])
    owner = await createTestUser(app, `owner${SUFFIX}`)
  })

  afterAll(async () => {
    for (const id of created) deleteEnvelopeFiles(id)
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  // Enveloppe signée prête à être finalisée (doc sur disque + 1 signataire signé + chaîne).
  async function seedSigned(): Promise<string> {
    const bytes = await makePdfBytes()
    const env = await prisma.signEnvelope.create({ data: { ownerId: owner.user.id, name: 'Scellage', originalHash: sha256(bytes), pageCount: 1, status: 'IN_PROGRESS' } })
    created.push(env.id)
    writeOriginal(env.id, bytes)
    const r = await prisma.signRecipient.create({ data: { envelopeId: env.id, email: `s${SUFFIX}`, name: 'Signataire', status: 'SIGNED', signedAt: new Date() } })
    await prisma.signField.create({ data: { envelopeId: env.id, recipientId: r.id, page: 0, x: 0.1, y: 0.7, w: 0.3, h: 0.1, type: 'SIGNATURE', value: PNG_1PX } })
    await recordEvent(env.id, 'created', { actorLabel: 'Owner' })
    await recordEvent(env.id, 'signed', { actorLabel: 'Signataire', recipientId: r.id })
    await recordEvent(env.id, 'completed', { actorLabel: 'system' })
    await prisma.signEnvelope.update({ where: { id: env.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
    return env.id
  }

  it('finalizeEnvelope produit un PDF scellé dont l’empreinte est cohérente', async () => {
    const id = await seedSigned()
    await finalizeEnvelope(id)

    const env = await prisma.signEnvelope.findUnique({ where: { id } })
    expect(env?.sealLevel).toBe('B')
    expect(env?.sealedHash).toBeTruthy()
    expect(sealedExists(id)).toBe(true)

    const sealed = readSealed(id)
    expect(sha256(sealed)).toBe(env!.sealedHash) // l'empreinte stockée correspond au fichier
    expect(sealed.toString('latin1')).toContain('/ByteRange') // sceau PAdES présent
    expect(await verifyChain(id)).toBe(true)
  })

  it('routes : /sealed, /verify (intégrité OK), /audit', async () => {
    const id = await seedSigned()
    await finalizeEnvelope(id)
    const auth = { authorization: `Bearer ${owner.token}` }

    const sealed = await app.inject({ method: 'GET', url: `/api/signdoc/${id}/sealed`, headers: auth })
    expect(sealed.statusCode).toBe(200)
    expect(sealed.headers['content-type']).toContain('application/pdf')

    const verify = await app.inject({ method: 'GET', url: `/api/signdoc/${id}/verify`, headers: auth })
    expect(verify.statusCode).toBe(200)
    expect(verify.json().chainValid).toBe(true)
    expect(verify.json().fileIntegrity).toBe(true)
    expect(verify.json().sealLevel).toBe('B')

    const audit = await app.inject({ method: 'GET', url: `/api/signdoc/${id}/audit`, headers: auth })
    expect(audit.statusCode).toBe(200)
    expect(audit.json().length).toBeGreaterThanOrEqual(3)
  })

  it('/sealed renvoie 404 tant que l’enveloppe n’est pas finalisée', async () => {
    const bytes = await makePdfBytes()
    const env = await prisma.signEnvelope.create({ data: { ownerId: owner.user.id, name: 'Pas scellée', originalHash: sha256(bytes), pageCount: 1, status: 'DRAFT' } })
    created.push(env.id)
    const res = await app.inject({ method: 'GET', url: `/api/signdoc/${env.id}/sealed`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(res.statusCode).toBe(404)
  })
})
