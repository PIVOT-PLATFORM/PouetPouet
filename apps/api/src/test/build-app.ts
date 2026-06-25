import Fastify, { type FastifyInstance, type FastifyPluginAsync, type FastifyRequest, type FastifyReply } from 'fastify'
import jwt from '@fastify/jwt'
import { ZodError } from 'zod'
import { prisma } from '../lib/prisma.js'

// Minimal Fastify instance mirroring the auth setup of index.ts, for
// integration tests against the real test database (app.inject, no port).
export async function buildTestApp(
  routes: { plugin: FastifyPluginAsync; prefix: string }[],
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  // Miroir de index.ts : une payload invalide répond 400, pas 500
  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: 'Requête invalide', details: err.issues })
    }
    throw err
  })
  await app.register(jwt, { secret: 'integration-test-secret', sign: { expiresIn: '4h' } })
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })
  for (const { plugin, prefix } of routes) {
    app.register(plugin, { prefix })
  }
  await app.ready()
  return app
}

// Creates a verified user directly in the DB and returns it with a signed JWT.
export async function createTestUser(app: FastifyInstance, email: string) {
  const user = await prisma.user.create({
    data: { email, name: 'Test User', password: 'not-a-real-hash', emailVerified: true },
  })
  const token = app.jwt.sign({ id: user.id, email: user.email })
  return { user, token }
}

// Removes every user whose email ends with the given suffix (cascades wipe
// their teams, webhooks, boards…). Each test file uses its own suffix.
export async function cleanupUsers(suffix: string) {
  await prisma.user.deleteMany({ where: { email: { endsWith: suffix } } })
}
