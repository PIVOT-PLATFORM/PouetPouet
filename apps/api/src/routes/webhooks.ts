import type { FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { audit } from '../lib/audit.js'

// Events that can be subscribed to via webhook
export const WEBHOOK_EVENTS = [
  'board.imported',
  'daily.session.ended',
  'scrum.ticket.estimated',
  'wheel.draw.completed',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

const createSchema = z.object({
  name: z.string().min(1).max(64),
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
})

const updateSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  active: z.boolean().optional(),
})

export const webhookRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: [app.authenticate] }, async (request) => {
    const { id: userId } = request.user as { id: string }
    return prisma.webhook.findMany({
      where: { userId },
      select: { id: true, name: true, url: true, events: true, active: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
  })

  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const count = await prisma.webhook.count({ where: { userId } })
    if (count >= 20) return reply.status(429).send({ error: 'Maximum 20 webhooks par compte.' })
    const body = createSchema.parse(request.body)
    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`
    const webhook = await prisma.webhook.create({
      data: { userId, name: body.name, url: body.url, events: body.events, secret },
      select: { id: true, name: true, url: true, events: true, active: true, secret: true, createdAt: true },
    })
    audit(userId, 'webhook.created', request, body.name)
    return reply.status(201).send(webhook)
  })

  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const body = updateSchema.parse(request.body)
    const existing = await prisma.webhook.findFirst({ where: { id, userId } })
    if (!existing) return reply.status(404).send({ error: 'Webhook introuvable.' })
    const updated = await prisma.webhook.update({
      where: { id },
      data: body,
      select: { id: true, name: true, url: true, events: true, active: true, createdAt: true },
    })
    return reply.send(updated)
  })

  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const existing = await prisma.webhook.findFirst({ where: { id, userId } })
    if (!existing) return reply.status(404).send({ error: 'Webhook introuvable.' })
    await prisma.webhook.delete({ where: { id } })
    audit(userId, 'webhook.deleted', request, existing.name)
    return reply.send({ ok: true })
  })

  // Test endpoint: sends a synthetic ping to the webhook and returns the HTTP status received.
  app.post('/:id/test', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const hook = await prisma.webhook.findFirst({ where: { id, userId } })
    if (!hook) return reply.status(404).send({ error: 'Webhook introuvable.' })
    const payload = JSON.stringify({
      event: 'ping',
      timestamp: new Date().toISOString(),
      payload: { message: 'Test de connexion depuis PouetPouet' },
    })
    const sig = crypto.createHmac('sha256', hook.secret).update(payload).digest('hex')
    const started = Date.now()
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${sig}`,
          'X-Webhook-Id': hook.id,
          'User-Agent': 'PouetPouet-Webhook/1.0',
        },
        body: payload,
        signal: AbortSignal.timeout(10000),
      })
      await recordDelivery(hook.id, 'ping', { statusCode: res.status }, Date.now() - started)
      return reply.send({ ok: res.ok, status: res.status })
    } catch (err) {
      await recordDelivery(hook.id, 'ping', { error: (err as Error).message }, Date.now() - started)
      return reply.send({ ok: false, error: (err as Error).message })
    }
  })

  // Delivery history (most recent first, capped at MAX_DELIVERIES_PER_HOOK by pruning).
  app.get('/:id/deliveries', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    const hook = await prisma.webhook.findFirst({ where: { id, userId }, select: { id: true } })
    if (!hook) return reply.status(404).send({ error: 'Webhook introuvable.' })
    return prisma.webhookDelivery.findMany({
      where: { webhookId: id },
      select: { id: true, event: true, statusCode: true, error: true, durationMs: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })
}

// Keep the delivery log bounded: only the most recent entries per webhook.
const MAX_DELIVERIES_PER_HOOK = 50

async function recordDelivery(
  webhookId: string,
  event: string,
  result: { statusCode?: number; error?: string },
  durationMs: number,
): Promise<void> {
  try {
    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        statusCode: result.statusCode ?? null,
        error: result.error?.slice(0, 500) ?? null,
        durationMs,
      },
    })
    // Prune beyond the cap. Deliveries are rare, so the extra query is fine.
    const excess = await prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_DELIVERIES_PER_HOOK,
      select: { id: true },
    })
    if (excess.length > 0) {
      await prisma.webhookDelivery.deleteMany({ where: { id: { in: excess.map((d) => d.id) } } })
    }
  } catch {
    // Logging must never break delivery.
  }
}

// Délai avant nouvelle tentative quand une livraison échoue (erreur réseau ou 5xx).
const RETRY_DELAY_MS = 30_000
// Surchargeable par les tests (le délai réel rendrait le test trop lent).
export let retryDelayMs = RETRY_DELAY_MS
export function setRetryDelayForTests(ms: number) { retryDelayMs = ms }

// Tente une livraison ; en cas d'échec retryable (réseau ou 5xx), une seconde
// tentative part après retryDelayMs. Chaque tentative est enregistrée.
async function deliverOne(
  hook: { id: string; url: string; secret: string },
  event: string,
  body: string,
  attempt = 1,
): Promise<void> {
  const sig = crypto.createHmac('sha256', hook.secret).update(body).digest('hex')
  const started = Date.now()
  let retryable = false
  try {
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${sig}`,
        'X-Webhook-Id': hook.id,
        'X-Webhook-Attempt': String(attempt),
        'User-Agent': 'PouetPouet-Webhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(10000),
    })
    retryable = res.status >= 500
    await recordDelivery(hook.id, event, { statusCode: res.status }, Date.now() - started)
  } catch (err) {
    retryable = true
    await recordDelivery(hook.id, event, { error: (err as Error).message }, Date.now() - started)
  }
  if (retryable && attempt === 1) {
    // unref : un retry en attente ne doit pas retarder l'arrêt du process
    setTimeout(() => void deliverOne(hook, event, body, 2), retryDelayMs).unref()
  }
}

// Delivers a webhook payload to all active subscribers for the given event.
// Fire-and-forget: errors are logged but never throw. HMAC-SHA256 signature in X-Webhook-Signature.
export async function deliverWebhooks(
  event: WebhookEvent,
  userId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const hooks = await prisma.webhook.findMany({
    where: { userId, active: true, events: { has: event } },
    select: { id: true, url: true, secret: true },
  })
  if (hooks.length === 0) return

  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), payload })
  await Promise.allSettled(hooks.map((hook) => deliverOne(hook, event, body)))
}
