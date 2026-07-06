import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { formsRoutes } from './forms.routes.js'
import { prisma } from '../../lib/prisma.js'

const SUFFIX = '@forms-recipients.int.test'

async function createForm(app: FastifyInstance, token: string, payload: Record<string, unknown>) {
  const res = await app.inject({ method: 'POST', url: '/api/forms', headers: { authorization: `Bearer ${token}` }, payload })
  return res.json()
}

async function publish(app: FastifyInstance, token: string, id: string) {
  const res = await app.inject({ method: 'PATCH', url: `/api/forms/${id}`, headers: { authorization: `Bearer ${token}` }, payload: { isPublished: true } })
  return res.json()
}

describe('Forms — destinataires nommés (integration)', () => {
  let app: FastifyInstance
  let owner: { user: { id: string }; token: string }
  let stranger: { user: { id: string }; token: string }
  let formId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: formsRoutes, prefix: '/api/forms' }])
    owner = await createTestUser(app, `owner${SUFFIX}`)
    stranger = await createTestUser(app, `stranger${SUFFIX}`)
    const created = await createForm(app, owner.token, {
      title: 'Logistique',
      fields: [{ id: 'q', label: 'Présence', type: 'radio', options: ['Oui', 'Non'], required: true }],
    })
    formId = created.id
    await publish(app, owner.token, formId)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('un tiers sans accès ne peut pas lister les destinataires (403)', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/forms/${formId}/recipients`, headers: { authorization: `Bearer ${stranger.token}` } })
    expect(res.statusCode).toBe(403)
  })

  it('POST /recipients — ajout en lot, doublons d\'email ignorés', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/forms/${formId}/recipients`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { recipients: [{ name: 'Alice', email: `alice${SUFFIX}` }, { name: 'Bob', email: `bob${SUFFIX}` }] },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ created: 2, skipped: 0 })

    // Re-soumettre les mêmes emails → tout est ignoré.
    const again = await app.inject({
      method: 'POST',
      url: `/api/forms/${formId}/recipients`,
      headers: { authorization: `Bearer ${owner.token}` },
      payload: { recipients: [{ name: 'Alice bis', email: `alice${SUFFIX}` }] },
    })
    expect(again.json()).toEqual({ created: 0, skipped: 1 })

    const list = await app.inject({ method: 'GET', url: `/api/forms/${formId}/recipients`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(list.json()).toHaveLength(2)
  })

  it('POST /recipients/send — envoi initial pose invitedAt', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/forms/${formId}/recipients/send`, headers: { authorization: `Bearer ${owner.token}` }, payload: {} })
    expect(res.statusCode).toBe(200)
    expect(res.json().sent).toBe(2)
    const recipients = await prisma.formRecipient.findMany({ where: { formId } })
    expect(recipients.every((r) => r.invitedAt !== null)).toBe(true)
  })

  it('GET /public/:token avec un token destinataire renvoie le formulaire + identité', async () => {
    const rec = await prisma.formRecipient.findFirst({ where: { formId, email: `alice${SUFFIX}` } })
    const res = await app.inject({ method: 'GET', url: `/api/forms/public/${rec!.token}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.recipient.name).toBe('Alice')
    expect(body.recipient.existingData).toBeNull()
  })

  it('POST /public/:token/responses via un token destinataire lie la réponse et marque répondu', async () => {
    const rec = await prisma.formRecipient.findFirst({ where: { formId, email: `alice${SUFFIX}` } })
    const res = await app.inject({ method: 'POST', url: `/api/forms/public/${rec!.token}/responses`, payload: { data: { q: 'Oui' } } })
    expect(res.statusCode).toBe(201)

    const refreshed = await prisma.formRecipient.findUnique({ where: { id: rec!.id } })
    expect(refreshed?.respondedAt).not.toBeNull()

    const response = await prisma.formResponse.findFirst({ where: { formId, recipientId: rec!.id } })
    expect((response?.data as Record<string, unknown>)?.q).toBe('Oui')
  })

  it('un second envoi sur le même lien met à jour la réponse existante (pas de doublon)', async () => {
    const rec = await prisma.formRecipient.findFirst({ where: { formId, email: `alice${SUFFIX}` } })
    await app.inject({ method: 'POST', url: `/api/forms/public/${rec!.token}/responses`, payload: { data: { q: 'Non' } } })

    const responses = await prisma.formResponse.findMany({ where: { formId, recipientId: rec!.id } })
    expect(responses).toHaveLength(1)
    expect((responses[0].data as Record<string, unknown>).q).toBe('Non')
  })

  it('GET /:id/recipients — statut Répondu/En attente cohérent', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/forms/${formId}/recipients`, headers: { authorization: `Bearer ${owner.token}` } })
    const list = res.json() as { email: string; respondedAt: string | null }[]
    const alice = list.find((r) => r.email === `alice${SUFFIX}`)
    const bob = list.find((r) => r.email === `bob${SUFFIX}`)
    expect(alice?.respondedAt).not.toBeNull()
    expect(bob?.respondedAt).toBeNull()
  })

  it('POST /:rid/remind — relance immédiate refusée par le cooldown (429)', async () => {
    const bob = await prisma.formRecipient.findFirst({ where: { formId, email: `bob${SUFFIX}` } })
    // invitedAt vient d'être posé par /send → cooldown actif.
    const res = await app.inject({ method: 'POST', url: `/api/forms/${formId}/recipients/${bob!.id}/remind`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(res.statusCode).toBe(429)
  })

  it('POST /:rid/remind — refusé si le destinataire a déjà répondu (400)', async () => {
    const alice = await prisma.formRecipient.findFirst({ where: { formId, email: `alice${SUFFIX}` } })
    const res = await app.inject({ method: 'POST', url: `/api/forms/${formId}/recipients/${alice!.id}/remind`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(res.statusCode).toBe(400)
  })

  it('DELETE /:id/responses/:responseId réinitialise le statut du destinataire', async () => {
    const rec = await prisma.formRecipient.findFirst({ where: { formId, email: `alice${SUFFIX}` } })
    const response = await prisma.formResponse.findFirst({ where: { formId, recipientId: rec!.id } })
    const res = await app.inject({ method: 'DELETE', url: `/api/forms/${formId}/responses/${response!.id}`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(res.statusCode).toBe(204)
    const refreshed = await prisma.formRecipient.findUnique({ where: { id: rec!.id } })
    expect(refreshed?.respondedAt).toBeNull()
  })

  it('CSV des réponses inclut les colonnes Nom/Email', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/forms/${formId}/responses.csv`, headers: { authorization: `Bearer ${owner.token}` } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('"Date","Nom","Email"')
  })

  it('DELETE /:id/recipients/:rid — un VIEWER ne peut pas supprimer', async () => {
    const viewer = await createTestUser(app, `viewer${SUFFIX}`)
    await prisma.moduleShare.create({ data: { module: 'form', resourceId: formId, userId: viewer.user.id, role: 'VIEWER' } })
    const bob = await prisma.formRecipient.findFirst({ where: { formId, email: `bob${SUFFIX}` } })
    const res = await app.inject({ method: 'DELETE', url: `/api/forms/${formId}/recipients/${bob!.id}`, headers: { authorization: `Bearer ${viewer.token}` } })
    expect(res.statusCode).toBe(403)
  })
})
