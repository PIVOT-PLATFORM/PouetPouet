import type { FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/mailer.js'

const USER_SELECT = {
  id: true, email: true, name: true, avatar: true, bio: true, theme: true, emailVerified: true, createdAt: true,
} as const

// Test-only shortcut, controlled by env, so the email step can be skipped while building.
// Set ALLOW_EMAIL_BYPASS=false (or leave unset) in production to disable it entirely.
const ALLOW_BYPASS = process.env.ALLOW_EMAIL_BYPASS === 'true'
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000
const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  bypass: z.boolean().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const verifySchema = z.object({ token: z.string().min(10) })
const resendSchema = z.object({ email: z.string().email() })

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

const deleteAccountSchema = z.object({
  password: z.string(),
})

const forgotSchema = z.object({ email: z.string().email() })
const resetSchema = z.object({ token: z.string().min(10), password: z.string().min(8) })

// Issues a fresh verification token, persists it, and emails the link.
// Returns whether the mail was actually sent over SMTP, plus a dev link to surface
// in the UI when there is no SMTP (only while the bypass is allowed).
async function issueVerification(user: { id: string; email: string; name: string }) {
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + VERIFY_TTL_MS)
  await prisma.user.update({
    where: { id: user.id },
    data: { verifyToken: token, verifyTokenExpires: expires },
  })
  const link = `${FRONTEND_URL}/verify-email?token=${token}`
  const sent = await sendVerificationEmail(user.email, user.name, link)
  return { sent, devLink: !sent && ALLOW_BYPASS ? link : undefined }
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body)
    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) return reply.status(409).send({ error: 'Email déjà utilisé' })

    const hashed = await bcrypt.hash(body.password, 12)

    // Test bypass: create an already-verified account and log in immediately.
    if (body.bypass && ALLOW_BYPASS) {
      const user = await prisma.user.create({
        data: { email: body.email, name: body.name, password: hashed, emailVerified: true },
        select: USER_SELECT,
      })
      const token = app.jwt.sign({ id: user.id, email: user.email })
      return reply.send({ user, token })
    }

    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, password: hashed },
      select: { id: true, email: true, name: true },
    })
    const { sent, devLink } = await issueVerification(user)
    return reply.send({ pending: true, email: user.email, emailSent: sent, devLink })
  })

  app.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user) return reply.status(401).send({ error: 'Identifiants invalides' })

    const valid = await bcrypt.compare(body.password, user.password)
    if (!valid) return reply.status(401).send({ error: 'Identifiants invalides' })

    if (!user.emailVerified) {
      return reply.status(403).send({
        error: 'Veuillez vérifier votre adresse email avant de vous connecter.',
        code: 'EMAIL_NOT_VERIFIED',
      })
    }

    const token = app.jwt.sign({ id: user.id, email: user.email })
    const { password: _, verifyToken: __, verifyTokenExpires: ___, ...safeUser } = user
    return reply.send({ user: safeUser, token })
  })

  app.post('/verify-email', async (request, reply) => {
    const { token } = verifySchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { verifyToken: token } })
    if (!user || !user.verifyTokenExpires || user.verifyTokenExpires < new Date()) {
      return reply.status(400).send({ error: 'Lien invalide ou expiré.', code: 'INVALID_TOKEN' })
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyToken: null, verifyTokenExpires: null },
      select: USER_SELECT,
    })
    // Verifying also logs the user in for a seamless first experience.
    const jwt = app.jwt.sign({ id: updated.id, email: updated.email })
    return reply.send({ user: updated, token: jwt })
  })

  app.post('/resend-verification', async (request, reply) => {
    const { email } = resendSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { email } })
    // Always answer ok so we never leak whether an account exists or is already verified.
    if (user && !user.emailVerified) {
      const { devLink } = await issueVerification(user)
      return reply.send({ ok: true, devLink })
    }
    return reply.send({ ok: true })
  })

  app.post('/refresh', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id, email } = request.user as { id: string; email: string }
    const token = app.jwt.sign({ id, email })
    return reply.send({ token })
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

  app.post('/forgot-password', async (request, reply) => {
    const { email } = forgotSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { email } })
    // Always reply ok so we never leak whether an account exists.
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const expires = new Date(Date.now() + RESET_TTL_MS)
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpires: expires },
      })
      const link = `${FRONTEND_URL}/reset-password?token=${token}`
      const sent = await sendPasswordResetEmail(user.email, user.name, link)
      if (!sent && ALLOW_BYPASS) {
        return reply.send({ ok: true, devLink: link })
      }
    }
    return reply.send({ ok: true })
  })

  app.post('/reset-password', async (request, reply) => {
    const { token, password } = resetSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { resetToken: token } })
    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return reply.status(400).send({ error: 'Lien invalide ou expiré.', code: 'INVALID_TOKEN' })
    }
    const hashed = await bcrypt.hash(password, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpires: null },
    })
    return reply.send({ ok: true })
  })

  // Permanent account deletion. Requires the current password as confirmation.
  // All owned data cascades via the schema's onDelete rules.
  app.post('/delete-account', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const { password } = deleteAccountSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return reply.status(404).send({ error: 'Utilisateur introuvable' })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return reply.status(401).send({ error: 'Mot de passe incorrect' })
    await prisma.user.delete({ where: { id } })
    return reply.send({ ok: true })
  })
}
