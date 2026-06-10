// Sentry doit s'initialiser avant le reste (instrumentation des imports suivants)
import { Sentry } from './lib/sentry.js'

import { readFileSync } from 'node:fs'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import { Server } from 'socket.io'

import { authRoutes } from './routes/auth.js'
import { boardRoutes } from './routes/boards.js'
import { sessionRoutes } from './routes/sessions.js'
import { scrumRoutes } from './routes/scrum.js'
import { dailyRoutes } from './routes/daily.js'
import { wheelRoutes } from './routes/wheel.js'
import { templateRoutes } from './routes/templates.js'
import { notificationRoutes } from './routes/notifications.js'
import { registerSocketHandlers } from './sockets/index.js'
import { setIO } from './lib/io.js'
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

app.register(authRoutes, { prefix: '/api/auth' })
app.register(boardRoutes, { prefix: '/api/boards' })
app.register(sessionRoutes, { prefix: '/api/sessions' })
app.register(scrumRoutes, { prefix: '/api/scrum' })
app.register(dailyRoutes, { prefix: '/api/daily' })
app.register(wheelRoutes, { prefix: '/api/wheel' })
app.register(templateRoutes, { prefix: '/api/templates' })
app.register(notificationRoutes, { prefix: '/api/notifications' })

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
