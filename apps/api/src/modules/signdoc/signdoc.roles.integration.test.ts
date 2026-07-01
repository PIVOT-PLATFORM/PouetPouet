import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { signdocRoutes } from './signdoc.routes.js'
import { shareRoutes } from '../../routes/shares.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@signdoc-roles.int.test'

describe('signdoc — permissions de partage (integration)', () => {
  let app: FastifyInstance
  let creator: { user: { id: string }; token: string }
  let editor: { user: { id: string; email: string }; token: string }
  let viewer: { user: { id: string; email: string }; token: string }
  let stranger: { user: { id: string; email: string }; token: string }
  let envelopeId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: signdocRoutes, prefix: '/api/signdoc' },
      { plugin: shareRoutes, prefix: '/api/shares' },
    ])
    creator = await createTestUser(app, `creator${SUFFIX}`)
    editor = await createTestUser(app, `editor${SUFFIX}`)
    viewer = await createTestUser(app, `viewer${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)

    const env = await prisma.signEnvelope.create({
      data: { name: 'Enveloppe partagée', ownerId: creator.user.id, originalHash: 'seed', pageCount: 2 },
    })
    envelopeId = env.id
    await prisma.moduleShare.createMany({
      data: [
        { module: 'signdoc', resourceId: envelopeId, userId: editor.user.id, role: 'EDITOR' },
        { module: 'signdoc', resourceId: envelopeId, userId: viewer.user.id, role: 'VIEWER' },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('liste les enveloppes partagées avec leur rôle', async () => {
    const ed = await app.inject({ method: 'GET', url: '/api/signdoc', headers: { authorization: `Bearer ${editor.token}` } })
    expect(ed.json().find((e: { id: string }) => e.id === envelopeId)?.role).toBe('EDITOR')
    const vw = await app.inject({ method: 'GET', url: '/api/signdoc', headers: { authorization: `Bearer ${viewer.token}` } })
    expect(vw.json().find((e: { id: string }) => e.id === envelopeId)?.role).toBe('VIEWER')
  })

  it('masque l’enveloppe à un étranger (détail 404)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/signdoc', headers: { authorization: `Bearer ${stranger.token}` } })
    expect(res.json().find((e: { id: string }) => e.id === envelopeId)).toBeUndefined()
    const detail = await app.inject({ method: 'GET', url: `/api/signdoc/${envelopeId}`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(detail.statusCode).toBe(404)
  })

  it('le lecteur lit le détail mais ne peut pas ajouter de signataire', async () => {
    const read = await app.inject({ method: 'GET', url: `/api/signdoc/${envelopeId}`, headers: { authorization: `Bearer ${viewer.token}` } })
    expect(read.statusCode).toBe(200)
    expect(read.json().role).toBe('VIEWER')
    const ko = await app.inject({
      method: 'POST', url: `/api/signdoc/${envelopeId}/recipients`,
      headers: { authorization: `Bearer ${viewer.token}` },
      payload: { email: `x${SUFFIX}`, name: 'X' },
    })
    expect(ko.statusCode).toBe(403)
  })

  it('l’éditeur peut ajouter un signataire, le lecteur non', async () => {
    const ok = await app.inject({
      method: 'POST', url: `/api/signdoc/${envelopeId}/recipients`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { email: `signer${SUFFIX}`, name: 'Signataire' },
    })
    expect(ok.statusCode).toBe(201)
  })

  it('seul le propriétaire supprime ; la suppression nettoie les partages', async () => {
    const ko = await app.inject({ method: 'DELETE', url: `/api/signdoc/${envelopeId}`, headers: { authorization: `Bearer ${editor.token}` } })
    expect(ko.statusCode).toBe(404)

    const tmp = await prisma.signEnvelope.create({ data: { name: 'Temp', ownerId: creator.user.id, originalHash: 'seed', pageCount: 1 } })
    await prisma.moduleShare.create({ data: { module: 'signdoc', resourceId: tmp.id, userId: editor.user.id, role: 'EDITOR' } })
    const ok = await app.inject({ method: 'DELETE', url: `/api/signdoc/${tmp.id}`, headers: { authorization: `Bearer ${creator.token}` } })
    expect(ok.statusCode).toBe(204)
    expect(await prisma.moduleShare.count({ where: { module: 'signdoc', resourceId: tmp.id } })).toBe(0)
  })

  it('gestion des partages : le propriétaire invite, l’éditeur non', async () => {
    const ko = await app.inject({
      method: 'POST', url: `/api/shares/signdoc/${envelopeId}/invite`,
      headers: { authorization: `Bearer ${editor.token}` },
      payload: { email: stranger.user.email, role: 'VIEWER' },
    })
    expect(ko.statusCode).toBe(403)
    const ok = await app.inject({
      method: 'POST', url: `/api/shares/signdoc/${envelopeId}/invite`,
      headers: { authorization: `Bearer ${creator.token}` },
      payload: { email: stranger.user.email, role: 'VIEWER' },
    })
    expect(ok.statusCode).toBe(201)
  })
})
