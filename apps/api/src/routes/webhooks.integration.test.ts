import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildTestApp, createTestUser, cleanupUsers } from '../test/build-app.js'
import { webhookRoutes, deliverWebhooks } from './webhooks.js'
import { prisma } from '../lib/prisma.js'

const SUFFIX = '@webhooks.int.test'

describe('/api/webhooks (integration)', () => {
  let app: FastifyInstance
  let userId: string
  let token: string
  let otherToken: string

  beforeAll(async () => {
    await cleanupUsers(SUFFIX)
    app = await buildTestApp([{ plugin: webhookRoutes, prefix: '/api/webhooks' }])
    const owner = await createTestUser(app, `owner${SUFFIX}`)
    userId = owner.user.id
    token = owner.token
    otherToken = (await createTestUser(app, `other${SUFFIX}`)).token
  })

  afterAll(async () => {
    await cleanupUsers(SUFFIX)
    await app.close()
  })

  it('creates a webhook and returns the secret once', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'CI hook', url: 'https://example.com/hook', events: ['daily.session.ended'] },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().secret).toMatch(/^whsec_/)

    const list = await app.inject({ method: 'GET', url: '/api/webhooks', headers: { authorization: `Bearer ${token}` } })
    expect(list.json()).toHaveLength(1)
    expect(list.json()[0].secret).toBeUndefined()
  })

  it('rejects an invalid event name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/webhooks',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Bad', url: 'https://example.com', events: ['not.an.event'] },
    })
    expect(res.statusCode).not.toBe(201)
  })

  it('records a failed delivery with the error message', async () => {
    // Port 9 (discard) is closed locally: fetch fails fast.
    const hook = await prisma.webhook.create({
      data: {
        userId,
        name: 'unreachable',
        url: 'http://127.0.0.1:9/hook',
        secret: 'whsec_test',
        events: ['daily.session.ended'],
      },
    })

    await deliverWebhooks('daily.session.ended', userId, { sessionId: 'test-session' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/webhooks/${hook.id}/deliveries`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const deliveries = res.json()
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({ event: 'daily.session.ended', statusCode: null })
    expect(deliveries[0].error).toBeTruthy()
    expect(deliveries[0].durationMs).toBeGreaterThanOrEqual(0)
  })

  it('does not deliver to inactive webhooks', async () => {
    const hook = await prisma.webhook.create({
      data: {
        userId,
        name: 'inactive',
        url: 'http://127.0.0.1:9/hook',
        secret: 'whsec_test2',
        events: ['daily.session.ended'],
        active: false,
      },
    })
    await deliverWebhooks('daily.session.ended', userId, {})
    const count = await prisma.webhookDelivery.count({ where: { webhookId: hook.id } })
    expect(count).toBe(0)
  })

  it('blocks access to another user deliveries', async () => {
    const mine = await prisma.webhook.findFirst({ where: { userId } })
    const res = await app.inject({
      method: 'GET',
      url: `/api/webhooks/${mine!.id}/deliveries`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('prunes the delivery log beyond 50 entries', async () => {
    const hook = await prisma.webhook.create({
      data: {
        userId,
        name: 'pruned',
        url: 'http://127.0.0.1:9/hook',
        secret: 'whsec_test3',
        events: ['wheel.draw.completed'],
      },
    })
    // Seed 55 deliveries directly, then trigger one real delivery (which prunes).
    await prisma.webhookDelivery.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        webhookId: hook.id,
        event: 'wheel.draw.completed',
        statusCode: 200,
        durationMs: i,
        createdAt: new Date(Date.now() - (60 - i) * 1000),
      })),
    })
    await deliverWebhooks('wheel.draw.completed', userId, {})
    const count = await prisma.webhookDelivery.count({ where: { webhookId: hook.id } })
    expect(count).toBeLessThanOrEqual(50)
  })

  it('deletes a webhook and cascades its deliveries', async () => {
    const hook = await prisma.webhook.findFirst({ where: { userId, name: 'unreachable' } })
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/webhooks/${hook!.id}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const count = await prisma.webhookDelivery.count({ where: { webhookId: hook!.id } })
    expect(count).toBe(0)
  })
})
