import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../../test/build-app.js'
import { procurementRoutes } from './procurement.routes.js'

// Un système externe (PGI/LDAP) non configuré ou injoignable doit répondre un
// 503 explicite, jamais un 500 brut (cf. ExternalUnavailableError).
const SUFFIX = '@ext-unavailable.int.test'

describe('procurement — service externe indisponible (integration)', () => {
  let app: FastifyInstance
  let user: { user: { id: string }; token: string }
  let savedLdapUrl: string | undefined

  beforeAll(async () => {
    savedLdapUrl = process.env.LDAP_API_URL
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: procurementRoutes, prefix: '/api/procurement' }])
    user = await createTestUser(app, `user${SUFFIX}`)
  })

  afterAll(async () => {
    if (savedLdapUrl !== undefined) process.env.LDAP_API_URL = savedLdapUrl
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('LDAP_API_URL absente → 503 avec message explicite', async () => {
    delete process.env.LDAP_API_URL
    const res = await app.inject({ method: 'GET', url: '/api/procurement/org-units', headers: { authorization: `Bearer ${user.token}` } })
    expect(res.statusCode).toBe(503)
    expect(res.json().error).toMatch(/service externe indisponible/i)
  })

  it('LDAP_API_URL pointant sur un service éteint → 503 aussi', async () => {
    process.env.LDAP_API_URL = 'http://127.0.0.1:59999' // rien n'écoute ici
    const res = await app.inject({ method: 'GET', url: '/api/procurement/org-units', headers: { authorization: `Bearer ${user.token}` } })
    expect(res.statusCode).toBe(503)
    expect(res.json().error).toMatch(/service externe indisponible/i)
  })
})
