import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { signdocRoutes } from './signdoc.routes.js'
import { prisma } from '../../lib/prisma.js'
import { recordEvent, verifyChain } from './signdoc.events.js'

const SUFFIX = '@signdoc.int.test'

// Crée une enveloppe seedée directement en base (sans passer par l'upload
// multipart) — les valeurs de fichier sont factices, les tests ne touchent
// pas le filesystem.
async function seedEnvelope(ownerId: string, name = 'Contrat') {
  return prisma.signEnvelope.create({ data: { ownerId, name, originalHash: 'seed-hash', pageCount: 3 } })
}

describe('signdoc — CRUD enveloppe + intégrité (integration)', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let envelopeId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: signdocRoutes, prefix: '/api/signdoc' }])
    owner = await createTestUser(app, `owner${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)
    envelopeId = (await seedEnvelope(owner.user.id)).id
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('liste l’enveloppe au propriétaire avec le rôle OWNER', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/signdoc', headers: { authorization: `Bearer ${owner.token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.json().find((e: { id: string }) => e.id === envelopeId)?.role).toBe('OWNER')
  })

  it('masque l’enveloppe à un étranger (liste + détail 404)', async () => {
    const list = await app.inject({ method: 'GET', url: '/api/signdoc', headers: { authorization: `Bearer ${stranger.token}` } })
    expect(list.json().find((e: { id: string }) => e.id === envelopeId)).toBeUndefined()
    const detail = await app.inject({ method: 'GET', url: `/api/signdoc/${envelopeId}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(detail.statusCode).toBe(404)
    const patch = await app.inject({ method: 'PATCH', url: `/api/signdoc/${envelopeId}`, headers: { authorization: `Bearer ${stranger.token}` }, payload: { name: 'Pirate' } })
    expect(patch.statusCode).toBe(404)
  })

  it('le propriétaire met à jour les métadonnées', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/signdoc/${envelopeId}`, headers: { authorization: `Bearer ${owner.token}` }, payload: { name: 'Contrat signé', ordered: true } })
    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Contrat signé')
    expect(res.json().ordered).toBe(true)
  })

  it('ajoute un signataire puis valide le placement des champs', async () => {
    const add = await app.inject({
      method: 'POST', url: `/api/signdoc/${envelopeId}/recipients`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { email: `bob${SUFFIX}`, name: 'Bob' },
    })
    expect(add.statusCode).toBe(201)
    const recipientId = add.json().id

    // Champ vers un signataire inconnu → 400
    const badRecipient = await app.inject({
      method: 'PUT', url: `/api/signdoc/${envelopeId}/fields`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { fields: [{ recipientId: 'nope', page: 0, x: 0.1, y: 0.1, w: 0.2, h: 0.05 }] },
    })
    expect(badRecipient.statusCode).toBe(400)

    // Champ sur une page hors document → 400
    const badPage = await app.inject({
      method: 'PUT', url: `/api/signdoc/${envelopeId}/fields`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { fields: [{ recipientId, page: 9, x: 0.1, y: 0.1, w: 0.2, h: 0.05 }] },
    })
    expect(badPage.statusCode).toBe(400)

    // Champ valide → enregistré
    const ok = await app.inject({
      method: 'PUT', url: `/api/signdoc/${envelopeId}/fields`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { fields: [{ recipientId, page: 0, x: 0.1, y: 0.1, w: 0.25, h: 0.06, type: 'SIGNATURE' }] },
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toHaveLength(1)
    expect(ok.json()[0].recipientId).toBe(recipientId)
  })

  it('la chaîne d’événements est vérifiable et détecte une altération', async () => {
    const env = await seedEnvelope(owner.user.id, 'Chaîne')
    await recordEvent(env.id, 'created', { actorLabel: 'Alice', payload: { pageCount: 3 } })
    await recordEvent(env.id, 'sent', { actorLabel: 'Alice' })
    await recordEvent(env.id, 'viewed', { actorLabel: 'Bob' })
    expect(await verifyChain(env.id)).toBe(true)

    // Altérer un événement passé doit casser la chaîne.
    const first = await prisma.signEvent.findFirst({ where: { envelopeId: env.id }, orderBy: { createdAt: 'asc' } })
    await prisma.signEvent.update({ where: { id: first!.id }, data: { actorLabel: 'Pirate' } })
    expect(await verifyChain(env.id)).toBe(false)
  })

  it('seul le propriétaire supprime l’enveloppe', async () => {
    const tmp = await seedEnvelope(owner.user.id, 'Jetable')
    const ko = await app.inject({ method: 'DELETE', url: `/api/signdoc/${tmp.id}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(ko.statusCode).toBe(404)
    const ok = await app.inject({ method: 'DELETE', url: `/api/signdoc/${tmp.id}`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(ok.statusCode).toBe(204)
    expect(await prisma.signEnvelope.findUnique({ where: { id: tmp.id } })).toBeNull()
  })
})
