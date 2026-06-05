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

const PORT = Number(process.env.PORT ?? 4000)

const app = Fastify({ logger: { level: 'info' } })

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

app.get('/health', async () => ({ status: 'ok' }))

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
