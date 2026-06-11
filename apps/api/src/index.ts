// Sentry doit s'initialiser avant le reste (instrumentation des imports suivants)
import { Sentry } from './lib/sentry.js'

import { readFileSync } from 'node:fs'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'

import { authRoutes } from './routes/auth.js'
import { sessionRoutes } from './routes/sessions.js'
import { notificationRoutes } from './routes/notifications.js'
import { hubRoutes } from './routes/hub.js'
import { registerModuleRoutes } from './modules/registry.js'
import { registerSocketHandlers } from './sockets/index.js'
import { setIO } from './lib/io.js'
import { bus } from './lib/bus.js'
import { notify } from './lib/notify.js'
import { prisma } from './lib/prisma.js'
import { redis } from './lib/redis.js'

const PORT = Number(process.env.PORT ?? 4000)

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ])
}

const app = Fastify({ logger: { level: 'info' } })

if (process.env.SENTRY_DSN) {
  Sentry.setupFastifyErrorHandler(app)
}

// Rate-limit actif uniquement en prod (pas de faux positifs en dev/test)
if (process.env.NODE_ENV === 'production') {
  await app.register(rateLimit, {
    global: false, // les limites sont déclarées par route dans auth.ts et boards.routes.ts
    redis,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (_req, ctx) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Trop de requêtes. Réessayez dans ${Math.ceil(ctx.ttl / 1000)} secondes.`,
    }),
  })
}

await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
})

await app.register(jwt, {
  secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  sign: { expiresIn: '30m' },
})

await app.register(cookie)

// Décorateur d'authentification utilisé comme preHandler dans les routes
app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.send(err)
  }
})

// Socle : identité, notifications, sessions live (services transverses)
app.register(authRoutes, { prefix: '/api/auth' })
app.register(sessionRoutes, { prefix: '/api/sessions' })
app.register(notificationRoutes, { prefix: '/api/notifications' })
app.register(hubRoutes, { prefix: '/api/hub' })

// Modules FORGE : montés depuis le registre (cf. modules/registry.ts)
registerModuleRoutes(app)

// Trace de tous les événements inter-modules
bus.subscribe('*', (e) => {
  app.log.info({ forgeEvent: e.type, module: e.module, payload: e.payload }, 'forge event')
})

// F3.2 — liaisons événementielles : les modules notifient leurs propriétaires via le bus.
bus.subscribe('daily.session.ended', async (e) => {
  const { sessionId } = e.payload as { sessionId: string }
  const session = await prisma.dailySession.findUnique({
    where: { id: sessionId },
    select: { ownerId: true, name: true },
  })
  if (session) {
    await notify({
      userId: session.ownerId,
      type: 'DAILY_SESSION_ENDED',
      title: 'Daily terminé',
      body: `"${session.name}" est terminé.`,
      link: '/daily',
    })
  }
})

bus.subscribe('scrum.ticket.estimated', async (e) => {
  const { roomId } = e.payload as { roomId: string }
  // Notifier uniquement si tous les tickets du sprint sont estimés.
  const [total, done] = await Promise.all([
    prisma.scrumTicket.count({ where: { roomId } }),
    prisma.scrumTicket.count({ where: { roomId, status: 'DONE' } }),
  ])
  if (total > 0 && total === done) {
    const room = await prisma.scrumRoom.findUnique({
      where: { id: roomId },
      select: { ownerId: true, name: true },
    })
    if (room) {
      await notify({
        userId: room.ownerId,
        type: 'SCRUM_ALL_ESTIMATED',
        title: 'Tous les tickets estimés',
        body: `"${room.name}" — ${total} ticket${total > 1 ? 's' : ''} estimé${total > 1 ? 's' : ''}.`,
        link: `/scrum`,
      })
    }
  }
})

// La DB est critique (503 si down) ; Redis est optionnel à ce stade → 'degraded' seulement
app.get('/health', async (_request, reply) => {
  const [database, cache] = await Promise.all([
    withTimeout(prisma.$queryRaw`SELECT 1`, 2000).then(
      () => 'ok' as const,
      () => 'unavailable' as const,
    ),
    withTimeout(redis.ping(), 2000).then(
      () => 'ok' as const,
      () => 'unavailable' as const,
    ),
  ])
  const status = database !== 'ok' ? 'unhealthy' : cache !== 'ok' ? 'degraded' : 'ok'
  reply.code(database === 'ok' ? 200 : 503)
  return { status, version: pkg.version, checks: { database, redis: cache } }
})

// Attendre que Fastify soit prêt avant d'attacher Socket.io
await app.ready()

const io = new Server(app.server, {
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})

// Redis adapter : active si Redis est connecté (prod avec REDIS_HOST).
// En dev/test (pas de Redis), l'adapteur in-memory par défaut est conservé.
if (redis.status === 'ready') {
  const subRedis = redis.duplicate()
  io.adapter(createAdapter(redis, subRedis))
  app.log.info('socket.io redis adapter active')
} else {
  // Écoute la connexion différée (Redis pas encore prêt au démarrage)
  redis.once('ready', () => {
    const subRedis = redis.duplicate()
    io.adapter(createAdapter(redis, subRedis))
    app.log.info('socket.io redis adapter active (deferred)')
  })
}

// Auth is optional: anonymous participants (no account) must be able to join
// sessions via /session/[code]. Privileged handlers (host_join, member_join,
// activity:launch, …) verify socket.data.userId / isHost themselves.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (token && typeof token === 'string') {
    try {
      const payload = app.jwt.verify<{ id: string; email: string }>(token)
      socket.data.userId = payload.id
    } catch {
      // Invalid/expired token → proceed as anonymous rather than refusing the
      // connection, so a stale token never blocks the participant flow.
    }
  }
  next()
})

setIO(io)
registerSocketHandlers(io)

await app.listen({ port: PORT, host: '0.0.0.0' })
