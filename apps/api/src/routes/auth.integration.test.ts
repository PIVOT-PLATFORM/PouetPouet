import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupUsers, createTestUser } from '../test/build-app.js'
import { authRoutes } from './auth.js'
import { prisma } from '../lib/prisma.js'

const SUFFIX = '@auth.int.test'

describe('/api/auth (integration)', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: authRoutes, prefix: '/api/auth' }])
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('registers a pending user and returns a dev verification link (no SMTP)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: `pending${SUFFIX}`, name: 'Pending', password: 'Password123!' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.pending).toBe(true)
    expect(body.emailSent).toBe(false)
    expect(body.devLink).toContain('/verify-email?token=')
  })

  it('rejects a duplicate email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: `pending${SUFFIX}`, name: 'Dup', password: 'Password123!' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('blocks login before email verification', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `pending${SUFFIX}`, password: 'Password123!' },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().code).toBe('EMAIL_NOT_VERIFIED')
  })

  it('verifies the email then allows login', async () => {
    const user = await prisma.user.findUnique({ where: { email: `pending${SUFFIX}` } })
    const verify = await app.inject({
      method: 'POST',
      url: '/api/auth/verify-email',
      payload: { token: user!.verifyToken },
    })
    expect(verify.statusCode).toBe(200)

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `pending${SUFFIX}`, password: 'Password123!' },
    })
    expect(login.statusCode).toBe(200)
    const body = login.json()
    expect(body.token).toBeTruthy()
    expect(body.user.password).toBeUndefined()
  })

  it('rejects a wrong password without leaking user existence', async () => {
    const wrongPass = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `pending${SUFFIX}`, password: 'WrongPassword!' },
    })
    const noUser = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `ghost${SUFFIX}`, password: 'WrongPassword!' },
    })
    expect(wrongPass.statusCode).toBe(401)
    expect(noUser.statusCode).toBe(401)
    expect(wrongPass.json().error).toBe(noUser.json().error)
  })

  it('creates a verified account immediately with the bypass flag', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: `bypass${SUFFIX}`, name: 'Bypass', password: 'Password123!', bypass: true },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeTruthy()
    expect(body.user.emailVerified).toBe(true)
  })

  it('records logins and failed attempts in the security log', async () => {
    // Successful login, then a failed one (audit writes are fire-and-forget → poll)
    const ok = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `bypass${SUFFIX}`, password: 'Password123!' },
    })
    expect(ok.statusCode).toBe(200)
    const token = ok.json().token
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `bypass${SUFFIX}`, password: 'Wrong!' },
    })

    await expect
      .poll(async () => {
        const res = await app.inject({
          method: 'GET',
          url: '/api/auth/security-log',
          headers: { authorization: `Bearer ${token}` },
        })
        return res.json().map((e: { action: string }) => e.action)
      }, { timeout: 3000 })
      .toEqual(expect.arrayContaining(['auth.login', 'auth.login_failed']))
  })

  it('links a pending TeamMember to the new account at registration (reconciliation)', async () => {
    const owner = await createTestUser(app, `teamowner${SUFFIX}`)
    const team = await prisma.team.create({ data: { name: 'Équipe en attente', ownerId: owner.user.id } })
    const pendingMember = await prisma.teamMember.create({
      data: { teamId: team.id, name: 'Future compte', email: `newmember${SUFFIX}` },
    })
    expect(pendingMember.userId).toBeNull()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: `newmember${SUFFIX}`, name: 'Nouveau', password: 'Password123!' },
    })
    expect(res.statusCode).toBe(200)
    const newUser = await prisma.user.findUnique({ where: { email: `newmember${SUFFIX}` } })

    const reconciled = await prisma.teamMember.findUnique({ where: { id: pendingMember.id } })
    expect(reconciled?.userId).toBe(newUser!.id)
    // Grade EDITOR posé au lien (même défaut qu'à la résolution immédiate)
    expect(reconciled?.teamRole).toBe('EDITOR')
  })
})
