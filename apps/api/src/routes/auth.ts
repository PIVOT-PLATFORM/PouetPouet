import type { FastifyPluginAsync } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const USER_SELECT = {
  id: true, email: true, name: true, avatar: true, bio: true, theme: true, createdAt: true,
} as const

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(500).nullable().optional(),
  theme: z.enum(['light', 'dark']).optional(),
})

const avatarSchema = z.object({
  avatar: z.string().max(2_000_000).nullable(),
})

const passwordSchema = z.object({
  current: z.string(),
  next: z.string().min(8),
})

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)
    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) return reply.status(409).send({ error: 'Email déjà utilisé' })

    const hashed = await bcrypt.hash(body.password, 12)
    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, password: hashed },
      select: USER_SELECT,
    })

    const token = app.jwt.sign({ id: user.id, email: user.email })
    return reply.send({ user, token })
  })

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user) return reply.status(401).send({ error: 'Identifiants invalides' })

    const valid = await bcrypt.compare(body.password, user.password)
    if (!valid) return reply.status(401).send({ error: 'Identifiants invalides' })

    const token = app.jwt.sign({ id: user.id, email: user.email })
    const { password: _, ...safeUser } = user
    return reply.send({ user: safeUser, token })
  })

  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT })
    if (!user) return reply.status(404).send({ error: 'Utilisateur introuvable' })
    return reply.send(user)
  })

  app.patch('/profile', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const body = profileSchema.parse(request.body)
    const data = {
      ...body,
      ...(body.bio !== undefined ? { bio: body.bio?.trim() || null } : {}),
    }
    const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT })
    return reply.send(user)
  })

  app.post('/avatar', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const { avatar } = avatarSchema.parse(request.body)
    const user = await prisma.user.update({ where: { id }, data: { avatar }, select: USER_SELECT })
    return reply.send(user)
  })

  app.patch('/password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const body = passwordSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return reply.status(404).send({ error: 'Utilisateur introuvable' })
    const valid = await bcrypt.compare(body.current, user.password)
    if (!valid) return reply.status(401).send({ error: 'Mot de passe actuel incorrect' })
    const hashed = await bcrypt.hash(body.next, 12)
    await prisma.user.update({ where: { id }, data: { password: hashed } })
    return reply.send({ ok: true })
  })
}
