import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { signdocRoutes } from './signdoc.routes.js'
import { signdocPublicRoutes } from './signdoc.public.routes.js'
import { hashToken } from './signdoc.workflow.js'
import { verifyChain } from './signdoc.events.js'
import { prisma } from '../../lib/prisma.js'
import type { SignStatus, SignRecipientStatus } from '@prisma/client'

const SUFFIX = '@signdoc-send.int.test'

// Crée une enveloppe + N signataires (chacun avec un champ requis) et des jetons
// d'accès connus (on stocke le hash, on garde le clair pour appeler /api/sign).
async function seedSendable(ownerId: string, opts: { ordered: boolean; status?: SignStatus }) {
  const env = await prisma.signEnvelope.create({
    data: { ownerId, name: 'À signer', originalHash: 'seed', pageCount: 2, ordered: opts.ordered, status: opts.status ?? 'SENT' },
  })
  return env
}

async function addSigner(envelopeId: string, email: string, routingOrder: number, token: string | null, status: SignRecipientStatus = 'SENT') {
  const r = await prisma.signRecipient.create({
    data: {
      envelopeId, email, name: email, routingOrder,
      status, accessTokenHash: token ? hashToken(token) : null,
      tokenExpires: token ? new Date(Date.now() + 86_400_000) : null,
    },
  })
  await prisma.signField.create({ data: { envelopeId, recipientId: r.id, page: 0, x: 0.1, y: 0.1, w: 0.2, h: 0.05, type: 'SIGNATURE', required: true } })
  return r
}

describe('signdoc — envoi + signature publique (integration)', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([
      { plugin: signdocRoutes, prefix: '/api/signdoc' },
      { plugin: signdocPublicRoutes, prefix: '/api/sign' },
    ])
    owner = await createTestUser(app, `owner${SUFFIX}`)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('/send refuse une enveloppe sans signataire puis sans champ, et réussit ensuite', async () => {
    const env = await prisma.signEnvelope.create({ data: { ownerId: owner.user.id, name: 'Draft', originalHash: 'seed', pageCount: 1, status: 'DRAFT' } })

    const noRecip = await app.inject({ method: 'POST', url: `/api/signdoc/${env.id}/send`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(noRecip.statusCode).toBe(400)

    const add = await app.inject({ method: 'POST', url: `/api/signdoc/${env.id}/recipients`, headers: { authorization: `Bearer ${owner.token}` }, payload: { email: `bob${SUFFIX}`, name: 'Bob' } })
    const rid = add.json().id

    const noField = await app.inject({ method: 'POST', url: `/api/signdoc/${env.id}/send`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(noField.statusCode).toBe(400)

    await app.inject({ method: 'PUT', url: `/api/signdoc/${env.id}/fields`, headers: { authorization: `Bearer ${owner.token}` }, payload: { fields: [{ recipientId: rid, page: 0, x: 0.1, y: 0.1, w: 0.2, h: 0.05, type: 'SIGNATURE' }] } })

    const ok = await app.inject({ method: 'POST', url: `/api/signdoc/${env.id}/send`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().status).toBe('SENT')
    const recip = await prisma.signRecipient.findUnique({ where: { id: rid } })
    expect(recip?.accessTokenHash).toBeTruthy() // un jeton a été généré
    expect(recip?.status).toBe('SENT')
  })

  it('signature parallèle : chaque signataire signe, l’enveloppe se complète', async () => {
    const env = await seedSendable(owner.user.id, { ordered: false })
    await addSigner(env.id, `a${SUFFIX}`, 1, 'tokenAAAAAAAA')
    await addSigner(env.id, `b${SUFFIX}`, 1, 'tokenBBBBBBBB')

    // Jeton invalide → 404 (anti-énumération)
    const bad = await app.inject({ method: 'GET', url: '/api/sign/zzzzzzzzzzzz' })
    expect(bad.statusCode).toBe(404)

    // Vue de A : son tour, marque VIEWED
    const viewA = await app.inject({ method: 'GET', url: '/api/sign/tokenAAAAAAAA' })
    expect(viewA.statusCode).toBe(200)
    expect(viewA.json().yourTurn).toBe(true)
    expect(viewA.json().fields).toHaveLength(1)
    const fieldA = viewA.json().fields[0].id

    // A signe → pas encore complété (B reste)
    const signA = await app.inject({ method: 'POST', url: '/api/sign/tokenAAAAAAAA/sign', payload: { fields: [{ id: fieldA, value: 'data:image/png;base64,AAAA' }] } })
    expect(signA.statusCode).toBe(200)
    expect(signA.json().completed).toBe(false)
    expect((await prisma.signEnvelope.findUnique({ where: { id: env.id } }))?.status).toBe('IN_PROGRESS')

    // A ne peut pas re-signer (jeton consommé)
    const reSign = await app.inject({ method: 'GET', url: '/api/sign/tokenAAAAAAAA' })
    expect(reSign.statusCode).toBe(404)

    // B signe → complété
    const viewB = await app.inject({ method: 'GET', url: '/api/sign/tokenBBBBBBBB' })
    const fieldB = viewB.json().fields[0].id
    const signB = await app.inject({ method: 'POST', url: '/api/sign/tokenBBBBBBBB/sign', payload: { fields: [{ id: fieldB, value: 'data:image/png;base64,BBBB' }] } })
    expect(signB.json().completed).toBe(true)
    const after = await prisma.signEnvelope.findUnique({ where: { id: env.id } })
    expect(after?.status).toBe('COMPLETED')
    expect(after?.completedAt).toBeTruthy()
    expect(await verifyChain(env.id)).toBe(true)
  })

  it('un champ requis non rempli est rejeté', async () => {
    const env = await seedSendable(owner.user.id, { ordered: false })
    await addSigner(env.id, `c${SUFFIX}`, 1, 'tokenCCCCCCCC')
    const res = await app.inject({ method: 'POST', url: '/api/sign/tokenCCCCCCCC/sign', payload: { fields: [] } })
    expect(res.statusCode).toBe(400)
  })

  it('refus de signer : l’enveloppe passe DECLINED', async () => {
    const env = await seedSendable(owner.user.id, { ordered: false })
    await addSigner(env.id, `d${SUFFIX}`, 1, 'tokenDDDDDDDD')
    const res = await app.inject({ method: 'POST', url: '/api/sign/tokenDDDDDDDD/decline', payload: { reason: 'Désaccord' } })
    expect(res.statusCode).toBe(200)
    expect((await prisma.signEnvelope.findUnique({ where: { id: env.id } }))?.status).toBe('DECLINED')
  })

  it('CC : reçoit un lien de consultation à l’envoi, ne peut ni signer ni refuser, ne bloque pas la complétion', async () => {
    const env = await prisma.signEnvelope.create({ data: { ownerId: owner.user.id, name: 'Avec copie', originalHash: 'seed', pageCount: 1, status: 'DRAFT' } })
    const add = await app.inject({ method: 'POST', url: `/api/signdoc/${env.id}/recipients`, headers: { authorization: `Bearer ${owner.token}` }, payload: { email: `signer-cc${SUFFIX}`, name: 'Signer' } })
    const rid = add.json().id
    const addCc = await app.inject({ method: 'POST', url: `/api/signdoc/${env.id}/recipients`, headers: { authorization: `Bearer ${owner.token}` }, payload: { email: `copy${SUFFIX}`, name: 'Copy', role: 'CC' } })
    const ccId = addCc.json().id
    await app.inject({ method: 'PUT', url: `/api/signdoc/${env.id}/fields`, headers: { authorization: `Bearer ${owner.token}` }, payload: { fields: [{ recipientId: rid, page: 0, x: 0.1, y: 0.1, w: 0.2, h: 0.05, type: 'SIGNATURE' }] } })

    const sent = await app.inject({ method: 'POST', url: `/api/signdoc/${env.id}/send`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(sent.statusCode).toBe(200)

    // Le CC a reçu un jeton de consultation à l'envoi.
    const cc = await prisma.signRecipient.findUnique({ where: { id: ccId } })
    expect(cc?.accessTokenHash).toBeTruthy()
    expect(cc?.status).toBe('SENT')

    // On fixe un jeton connu pour appeler les routes publiques en tant que CC.
    await prisma.signRecipient.update({ where: { id: ccId }, data: { accessTokenHash: hashToken('tokenCCCOPY01') } })
    const view = await app.inject({ method: 'GET', url: '/api/sign/tokenCCCOPY01' })
    expect(view.statusCode).toBe(200)
    expect(view.json().recipient.role).toBe('CC')
    expect(view.json().yourTurn).toBe(false)

    // Un CC ne peut ni signer ni refuser.
    const sign = await app.inject({ method: 'POST', url: '/api/sign/tokenCCCOPY01/sign', payload: { fields: [] } })
    expect(sign.statusCode).toBe(409)
    const decline = await app.inject({ method: 'POST', url: '/api/sign/tokenCCCOPY01/decline', payload: {} })
    expect(decline.statusCode).toBe(403)

    // Le signataire signe seul → complétion malgré le CC non « signé ».
    await prisma.signRecipient.update({ where: { id: rid }, data: { accessTokenHash: hashToken('tokenSIGNER01') } })
    const viewS = await app.inject({ method: 'GET', url: '/api/sign/tokenSIGNER01' })
    const fieldId = viewS.json().fields[0].id
    const signS = await app.inject({ method: 'POST', url: '/api/sign/tokenSIGNER01/sign', payload: { fields: [{ id: fieldId, value: 'data:image/png;base64,SSSS' }] } })
    expect(signS.json().completed).toBe(true)

    // À la complétion le CC a reçu un nouveau jeton pour télécharger le document.
    const ccAfter = await prisma.signRecipient.findUnique({ where: { id: ccId } })
    expect(ccAfter?.accessTokenHash).toBeTruthy()
    expect(ccAfter?.accessTokenHash).not.toBe(hashToken('tokenCCCOPY01'))
  })
})
