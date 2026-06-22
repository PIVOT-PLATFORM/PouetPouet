// Sentry doit s'initialiser avant le reste (instrumentation des imports suivants)
import { Sentry } from './lib/sentry.js'

import { readFileSync } from 'node:fs'
import { ZodError } from 'zod'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'

import { authRoutes } from './routes/auth.js'
import { oidcRoutes } from './routes/oidc.js'
import { sessionRoutes } from './routes/sessions.js'
import { notificationRoutes } from './routes/notifications.js'
import { hubRoutes } from './routes/hub.js'
import { teamRoutes } from './routes/teams.js'
import { webhookRoutes, deliverWebhooks } from './routes/webhooks.js'
import { flagRoutes } from './routes/flags.js'
import { shareRoutes } from './routes/shares.js'
import { gamesRoutes } from './modules/games/games.routes.js'
import { registerModuleRoutes } from './modules/registry.js'
import { registerSocketHandlers } from './sockets/index.js'
import { setIO, getIO } from './lib/io.js'
import { bus } from './lib/bus.js'
import { prisma } from './lib/prisma.js'
import { redis } from './lib/redis.js'
import { scheduleRetention } from './lib/retention.js'

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

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    // Redact PII so passwords and tokens never appear in production logs.
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.secret'],
      censor: '[REDACTED]',
    },
  },
})

if (process.env.SENTRY_DSN) {
  Sentry.setupFastifyErrorHandler(app)
}

// Une payload invalide (ZodError) est une erreur client : 400, pas 500.
app.setErrorHandler((err, _request, reply) => {
  if (err instanceof ZodError) {
    return reply.status(400).send({ error: 'Requête invalide', details: err.issues })
  }
  throw err
})

// Rate-limit actif uniquement en prod (pas de faux positifs en dev/test)
if (process.env.NODE_ENV === 'production') {
  await app.register(rateLimit, {
    global: false, // les limites sont déclarées par route dans auth.ts et boards.routes.ts
    redis,
    // Sans Redis joignable (pas de Memorystore), on laisse passer plutôt que
    // de 500 sur login/register — le rate limiting redevient actif avec Redis.
    skipOnError: true,
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

// OpenAPI docs — disponibles uniquement hors production (/documentation)
if (process.env.NODE_ENV !== 'production') {
  await app.register(swagger, {
    openapi: {
      info: { title: 'PouetPouet API', version: pkg.version, description: 'FORGE — suite collaborative data-centric' },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  })
  await app.register(swaggerUi, { routePrefix: '/documentation' })
}

// Décorateur d'authentification utilisé comme preHandler dans les routes.
// Accepte un JWT (cookie/bearer) OU une clé API dans X-API-Key.
app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
  const apiKey = request.headers['x-api-key'] as string | undefined
  if (apiKey) {
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(apiKey).digest('hex')
    const key = await prisma.apiKey.findUnique({
      where: { keyHash: hash },
      select: { id: true, userId: true, expiresAt: true },
    })
    if (!key || (key.expiresAt && key.expiresAt < new Date())) {
      return reply.status(401).send({ error: 'Clé API invalide ou expirée.' })
    }
    // Update lastUsedAt without blocking the request
    prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {})
    const user = await prisma.user.findUnique({
      where: { id: key.userId },
      select: { id: true, email: true },
    })
    if (!user) return reply.status(401).send({ error: 'Utilisateur introuvable.' })
    request.user = { id: user.id, email: user.email }
    return
  }
  try {
    await request.jwtVerify()
  } catch (err) {
    reply.send(err)
  }
})

// Socle : identité, notifications, sessions live (services transverses)
app.register(authRoutes, { prefix: '/api/auth' })
app.register(oidcRoutes, { prefix: '/api/auth/oidc' })
app.register(sessionRoutes, { prefix: '/api/sessions' })
app.register(notificationRoutes, { prefix: '/api/notifications' })
app.register(hubRoutes, { prefix: '/api/hub' })
app.register(teamRoutes, { prefix: '/api/teams' })
app.register(webhookRoutes, { prefix: '/api/webhooks' })
app.register(flagRoutes, { prefix: '/api' })
app.register(shareRoutes, { prefix: '/api/shares' })
app.register(gamesRoutes, { prefix: '/api/games' })

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
    select: { ownerId: true },
  })
  if (session) {
    await deliverWebhooks('daily.session.ended', session.ownerId, e.payload as Record<string, unknown>)
  }
})

bus.subscribe('scrum.ticket.estimated', async (e) => {
  const { roomId } = e.payload as { roomId: string }
  // Notifier uniquement si tous les tickets du sprint sont estimés.
  const tickets = await prisma.scrumTicket.findMany({
    where: { roomId },
    select: { status: true, estimate: true },
  })
  const done = tickets.filter((t) => t.status === 'DONE').length
  if (tickets.length > 0 && tickets.length === done) {
    const totalPoints = tickets.reduce((sum, t) => {
      const n = t.estimate ? Number(t.estimate) : NaN
      return sum + (isNaN(n) ? 0 : n)
    }, 0)
    const room = await prisma.scrumRoom.findUnique({
      where: { id: roomId },
      select: { ownerId: true, teamId: true },
    })
    if (room) {
      // F3.2 — Scrum→Capacity: si la salle est liée à une équipe et qu'il existe un sprint
      // en phase PLANNING sans committedPoints définis, on y remonte la vélocité estimée.
      if (room.teamId && totalPoints > 0) {
        const activeSprint = await prisma.capacityEvent.findFirst({
          where: { teamId: room.teamId, ownerId: room.ownerId, status: 'PLANNING', committedPoints: null },
          orderBy: { startDate: 'asc' },
        })
        if (activeSprint) {
          await prisma.capacityEvent.update({
            where: { id: activeSprint.id },
            data: { committedPoints: totalPoints },
          })
        }
      }

      await deliverWebhooks('scrum.ticket.estimated', room.ownerId, { ...e.payload as Record<string, unknown>, totalPoints })
    }
  }
})

bus.subscribe('pouetpouet.board.imported', async (e) => {
  if (!e.actorId) return
  await deliverWebhooks('board.imported', e.actorId, e.payload as Record<string, unknown>)
})

bus.subscribe('wheel.draw.completed', async (e) => {
  if (!e.actorId) return
  await deliverWebhooks('wheel.draw.completed', e.actorId, e.payload as Record<string, unknown>)
})

// Prometheus-compatible metrics — only exposed when METRICS_TOKEN is set in env.
// Scraped by e.g. a Cloud Run sidecar or an external Prometheus instance.
app.get('/metrics', async (request, reply) => {
  const token = process.env.METRICS_TOKEN
  if (token) {
    const auth = request.headers.authorization
    if (auth !== `Bearer ${token}`) return reply.status(401).send('Unauthorized')
  }
  const io = getIO()
  const connections = io?.engine.clientsCount ?? 0
  const rooms = io ? io.sockets.adapter.rooms.size : 0
  const mem = process.memoryUsage()
  const lines = [
    '# HELP pivot_socket_connections_active Active WebSocket connections',
    '# TYPE pivot_socket_connections_active gauge',
    `pivot_socket_connections_active ${connections}`,
    '# HELP pivot_socket_rooms_active Active socket rooms (boards + users + sessions)',
    '# TYPE pivot_socket_rooms_active gauge',
    `pivot_socket_rooms_active ${rooms}`,
    '# HELP pivot_process_heap_bytes Node.js heap used (bytes)',
    '# TYPE pivot_process_heap_bytes gauge',
    `pivot_process_heap_bytes ${mem.heapUsed}`,
    '# HELP pivot_process_rss_bytes Node.js RSS memory (bytes)',
    '# TYPE pivot_process_rss_bytes gauge',
    `pivot_process_rss_bytes ${mem.rss}`,
  ]
  reply.type('text/plain; version=0.0.4').send(lines.join('\n') + '\n')
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
// Le client subscriber NE doit PAS hériter de lazyConnect/enableOfflineQueue:false :
// son psubscribe partirait avant la connexion et échouerait définitivement.
function attachRedisAdapter(label: string) {
  const subRedis = redis.duplicate({ lazyConnect: false, enableOfflineQueue: true })
  subRedis.on('error', () => {})
  io.adapter(createAdapter(redis, subRedis))
  app.log.info(`socket.io redis adapter active${label}`)
}
if (redis.status === 'ready') {
  attachRedisAdapter('')
} else {
  // Écoute la connexion différée (Redis pas encore prêt au démarrage)
  redis.once('ready', () => attachRedisAdapter(' (deferred)'))
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

// Purge quotidienne des données inactives (sessions fermées, notifs lues, audit)
scheduleRetention(app.log)

await app.listen({ port: PORT, host: '0.0.0.0' })
