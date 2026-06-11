import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupUsers } from '../test/build-app.js'
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
})
