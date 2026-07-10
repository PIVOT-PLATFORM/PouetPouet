import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { testbooksRoutes } from './testbooks.routes.js'

const SUFFIX = '@testbooks.int.test'

function auth(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('TestBooks — cahiers, sections, cas de test', () => {
  let app: FastifyInstance
  let alice: { user: { id: string }; token: string }
  let bob: { user: { id: string }; token: string }
  let bookId: string
  let sectionId: string
  let caseId: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: testbooksRoutes, prefix: '/api/testbooks' }])
    alice = await createTestUser(app, `alice${SUFFIX}`)
    bob = await createTestUser(app, `bob${SUFFIX}`)
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('POST / sans titre → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/testbooks', headers: auth(alice.token), payload: { title: '  ' } })
    expect(res.statusCode).toBe(400)
  })

  it('POST / crée un cahier appartenant à l\'auteur', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/testbooks', headers: auth(alice.token), payload: { title: 'Cahier Sprint 1' } })
    expect(res.statusCode).toBe(201)
    bookId = res.json().id
    expect(res.json().ownerId).toBe(alice.user.id)
  })

  it('GET / ne liste que les cahiers de l\'utilisateur courant', async () => {
    const asAlice = await app.inject({ method: 'GET', url: '/api/testbooks', headers: auth(alice.token) })
    const asBob = await app.inject({ method: 'GET', url: '/api/testbooks', headers: auth(bob.token) })
    expect(asAlice.json().some((b: { id: string }) => b.id === bookId)).toBe(true)
    expect(asBob.json().some((b: { id: string }) => b.id === bookId)).toBe(false)
  })

  it('GET /:id — un tiers ne peut pas voir le cahier d\'un autre → 404', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/testbooks/${bookId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(404)
  })

  it('PATCH /:id — un tiers ne peut pas éditer → 404', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/testbooks/${bookId}`, headers: auth(bob.token), payload: { title: 'pirate' } })
    expect(res.statusCode).toBe(404)
  })

  it('PATCH /:id — le propriétaire édite son cahier', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/testbooks/${bookId}`, headers: auth(alice.token), payload: { title: 'Cahier édité' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().title).toBe('Cahier édité')
  })

  it('PATCH /:id — un ownerId injecté dans le body est ignoré (anti mass-assignment)', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/testbooks/${bookId}`, headers: auth(alice.token), payload: { title: 'Toujours à Alice', ownerId: bob.user.id } })
    expect(res.statusCode).toBe(200)
    const stillMine = await app.inject({ method: 'GET', url: `/api/testbooks/${bookId}`, headers: auth(alice.token) })
    expect(stillMine.statusCode).toBe(200)
    const bobCannotSeeIt = await app.inject({ method: 'GET', url: `/api/testbooks/${bookId}`, headers: auth(bob.token) })
    expect(bobCannotSeeIt.statusCode).toBe(404)
  })

  it('POST /:id/sections — un tiers ne peut pas ajouter de section → 404', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/testbooks/${bookId}/sections`, headers: auth(bob.token), payload: { title: 'Section pirate' } })
    expect(res.statusCode).toBe(404)
  })

  it('POST /:id/sections — le propriétaire crée une section (order incrémental)', async () => {
    const first = await app.inject({ method: 'POST', url: `/api/testbooks/${bookId}/sections`, headers: auth(alice.token), payload: { title: 'Section A' } })
    expect(first.statusCode).toBe(201)
    expect(first.json().order).toBe(0)
    sectionId = first.json().id

    const second = await app.inject({ method: 'POST', url: `/api/testbooks/${bookId}/sections`, headers: auth(alice.token), payload: { title: 'Section B' } })
    expect(second.json().order).toBe(1)
  })

  it('PATCH /sections/:sectionId — un bookId injecté dans le body est ignoré (anti mass-assignment cross-tenant)', async () => {
    const bobsBook = await app.inject({ method: 'POST', url: '/api/testbooks', headers: auth(bob.token), payload: { title: 'Cahier de Bob' } })
    const res = await app.inject({ method: 'PATCH', url: `/api/testbooks/sections/${sectionId}`, headers: auth(alice.token), payload: { title: 'Toujours dans le cahier d\'Alice', bookId: bobsBook.json().id } })
    expect(res.statusCode).toBe(200)
    const book = await app.inject({ method: 'GET', url: `/api/testbooks/${bookId}`, headers: auth(alice.token) })
    expect(book.json().sections.some((s: { id: string }) => s.id === sectionId)).toBe(true)
  })

  it('POST /sections/:sectionId/cases — un tiers ne peut pas ajouter de cas → 404', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/testbooks/sections/${sectionId}/cases`, headers: auth(bob.token), payload: { title: 'Cas pirate' } })
    expect(res.statusCode).toBe(404)
  })

  it('POST /sections/:sectionId/cases — le propriétaire crée un cas de test', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/testbooks/sections/${sectionId}/cases`, headers: auth(alice.token), payload: { title: 'Se connecter', steps: '1. ...' } })
    expect(res.statusCode).toBe(201)
    caseId = res.json().id
    expect(res.json().title).toBe('Se connecter')
  })

  it('PATCH /cases/:caseId — un sectionId injecté dans le body est ignoré (anti mass-assignment cross-tenant)', async () => {
    const bobsBook = await app.inject({ method: 'POST', url: '/api/testbooks', headers: auth(bob.token), payload: { title: 'Cahier de Bob 2' } })
    const bobsSection = await app.inject({ method: 'POST', url: `/api/testbooks/${bobsBook.json().id}/sections`, headers: auth(bob.token), payload: { title: 'Section de Bob' } })
    const res = await app.inject({ method: 'PATCH', url: `/api/testbooks/cases/${caseId}`, headers: auth(alice.token), payload: { title: 'Toujours dans la section d\'Alice', sectionId: bobsSection.json().id } })
    expect(res.statusCode).toBe(200)
    const book = await app.inject({ method: 'GET', url: `/api/testbooks/${bookId}`, headers: auth(alice.token) })
    const originalSection = book.json().sections.find((s: { id: string }) => s.id === sectionId)
    expect(originalSection.cases.some((c: { id: string }) => c.id === caseId)).toBe(true)
  })

  it('PATCH /cases/:caseId — un tiers ne peut pas éditer → 404', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/testbooks/cases/${caseId}`, headers: auth(bob.token), payload: { status: 'PASS' } })
    expect(res.statusCode).toBe(404)
  })

  it('PATCH /cases/:caseId — le propriétaire change le statut', async () => {
    const res = await app.inject({ method: 'PATCH', url: `/api/testbooks/cases/${caseId}`, headers: auth(alice.token), payload: { status: 'PASS' } })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('PASS')
  })

  it('GET /:id — inclut sections et cas triés par order', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/testbooks/${bookId}`, headers: auth(alice.token) })
    const book = res.json()
    expect(book.sections.length).toBe(2)
    expect(book.sections[0].cases.some((c: { id: string }) => c.id === caseId)).toBe(true)
  })

  it('DELETE /cases/:caseId — un tiers ne peut pas supprimer → 404', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/testbooks/cases/${caseId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /cases/:caseId — le propriétaire supprime → 204', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/testbooks/cases/${caseId}`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(204)
  })

  it('DELETE /sections/:sectionId — un tiers ne peut pas supprimer → 404', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/testbooks/sections/${sectionId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /sections/:sectionId — le propriétaire supprime → 204', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/testbooks/sections/${sectionId}`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(204)
  })

  it('DELETE /:id — un tiers ne peut pas supprimer le cahier → 404', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/testbooks/${bookId}`, headers: auth(bob.token) })
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /:id — le propriétaire supprime → 204', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/testbooks/${bookId}`, headers: auth(alice.token) })
    expect(res.statusCode).toBe(204)
  })
})
