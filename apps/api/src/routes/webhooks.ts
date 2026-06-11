import type { FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

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
      return reply.send({ ok: res.ok, status: res.status })
    } catch (err) {
      return reply.send({ ok: false, error: (err as Error).message })
    }
  })
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
  await Promise.allSettled(
    hooks.map(async (hook) => {
      const sig = crypto.createHmac('sha256', hook.secret).update(body).digest('hex')
      try {
        await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${sig}`,
            'X-Webhook-Id': hook.id,
            'User-Agent': 'PouetPouet-Webhook/1.0',
          },
          body,
          signal: AbortSignal.timeout(10000),
        })
      } catch {
        // Delivery failures are silently ignored (no retry for MVP)
      }
    }),
  )
}
