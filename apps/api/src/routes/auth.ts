import type { FastifyPluginAsync } from 'fastify'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../lib/mailer.js'
import { audit } from '../lib/audit.js'
import { isAdminEmail } from '../lib/feature-flags.js'

const USER_SELECT = {
  id: true, email: true, name: true, avatar: true, bio: true, theme: true, palette: true, emailVerified: true, favoriteModules: true, createdAt: true,
} as const

// Enrichit l'objet user renvoyé au client avec `isAdmin` (allowlist ADMIN_EMAILS, non persisté).
function withAdmin<T extends { email: string }>(u: T): T & { isAdmin: boolean } {
  return { ...u, isAdmin: isAdminEmail(u.email) }
}

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
  theme: z.enum(['light', 'dark', 'system']).optional(),
  palette: z.enum(['default', 'fde-bleu-vert', 'fde-orange-vert', 'fde-bleu-orange', 'amethyste', 'ocean', 'rubis']).optional(),
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
  app.post('/register', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (request, reply) => {
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
      return reply.send({ user: withAdmin(user), token })
    }

    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, password: hashed },
      select: { id: true, email: true, name: true },
    })
    const { sent, devLink } = await issueVerification(user)
    return reply.send({ pending: true, email: user.email, emailSent: sent, devLink })
  })

  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '5 minutes' } } }, async (request, reply) => {
    const body = loginSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user) return reply.status(401).send({ error: 'Identifiants invalides' })

    const valid = await bcrypt.compare(body.password, user.password)
    if (!valid) {
      audit(user.id, 'auth.login_failed', request)
      return reply.status(401).send({ error: 'Identifiants invalides' })
    }

    if (!user.emailVerified) {
      return reply.status(403).send({
        error: 'Veuillez vérifier votre adresse email avant de vous connecter.',
        code: 'EMAIL_NOT_VERIFIED',
      })
    }

    const token = app.jwt.sign({ id: user.id, email: user.email })
    audit(user.id, 'auth.login', request)
    const { password: _, verifyToken: __, verifyTokenExpires: ___, ...safeUser } = user
    return reply.send({ user: withAdmin(safeUser), token })
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
    return reply.send({ user: withAdmin(updated), token: jwt })
  })

  app.post('/resend-verification', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async (request, reply) => {
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
    return reply.send(withAdmin(user))
  })

  app.patch('/profile', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const body = profileSchema.parse(request.body)
    const data = {
      ...body,
      ...(body.bio !== undefined ? { bio: body.bio?.trim() || null } : {}),
    }
    const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT })
    return reply.send(withAdmin(user))
  })

  app.post('/avatar', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const { avatar } = avatarSchema.parse(request.body)
    const user = await prisma.user.update({ where: { id }, data: { avatar }, select: USER_SELECT })
    return reply.send(withAdmin(user))
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
    audit(id, 'auth.password_changed', request)
    return reply.send({ ok: true })
  })

  app.post('/forgot-password', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async (request, reply) => {
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
    audit(user.id, 'auth.password_reset', request)
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

  // RGPD export — dumps all personal data owned by the caller as JSON.
  // Passwords and tokens are always excluded from the export.
  app.get('/export', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const [user, boards, scrumRooms, dailySessions, capacityEvents, wheelEvents, notifications] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, name: true, avatar: true, bio: true, theme: true, emailVerified: true, createdAt: true, updatedAt: true },
      }),
      prisma.board.findMany({ where: { ownerId: id }, select: { id: true, name: true, description: true, createdAt: true } }),
      prisma.scrumRoom.findMany({ where: { ownerId: id }, select: { id: true, name: true, code: true, createdAt: true } }),
      prisma.dailySession.findMany({ where: { ownerId: id }, select: { id: true, name: true, createdAt: true } }),
      prisma.capacityEvent.findMany({ where: { ownerId: id }, select: { id: true, name: true, type: true, startDate: true, endDate: true, createdAt: true } }),
      prisma.wheelEvent.findMany({ where: { ownerId: id }, select: { id: true, name: true, createdAt: true } }),
      prisma.notification.findMany({ where: { userId: id }, select: { id: true, type: true, title: true, body: true, createdAt: true } }),
    ])
    const filename = `pouetpouet-export-${new Date().toISOString().slice(0, 10)}.json`
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    reply.header('Content-Type', 'application/json')
    audit(id, 'account.exported', request)
    return reply.send(JSON.stringify({ exportedAt: new Date().toISOString(), user, boards, scrumRooms, dailySessions, capacityEvents, wheelEvents, notifications }, null, 2))
  })

  // Journal de sécurité — dernières actions sensibles du compte (audit trail).
  app.get('/security-log', { preHandler: [app.authenticate] }, async (request) => {
    const { id } = request.user as { id: string }
    return prisma.auditLog.findMany({
      where: { userId: id },
      select: { id: true, action: true, resource: true, ip: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })

  // ── API Keys ──────────────────────────────────────────────────────────────────
  // Keys use the format pp_<64 hex chars>. Only the SHA-256 hash is stored.
  // The prefix (first 8 chars after "pp_") is stored in plain text for display.

  const apiKeyNameSchema = z.object({ name: z.string().min(1).max(64) })

  app.get('/keys', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const keys = await prisma.apiKey.findMany({
      where: { userId: id },
      select: { id: true, name: true, prefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(keys)
  })

  app.post('/keys', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const { name } = apiKeyNameSchema.parse(request.body)

    const count = await prisma.apiKey.count({ where: { userId: id } })
    if (count >= 10) return reply.status(429).send({ error: 'Maximum 10 clés API par compte.' })

    const raw = `pp_${crypto.randomBytes(32).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(raw).digest('hex')
    const prefix = raw.slice(3, 11)

    await prisma.apiKey.create({ data: { userId: id, name, keyHash, prefix } })
    audit(id, 'apikey.created', request, name)
    return reply.status(201).send({ key: raw, name, prefix })
  })

  app.delete('/keys/:keyId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const { keyId } = request.params as { keyId: string }
    const key = await prisma.apiKey.findFirst({ where: { id: keyId, userId: id } })
    if (!key) return reply.status(404).send({ error: 'Clé introuvable.' })
    await prisma.apiKey.delete({ where: { id: keyId } })
    audit(id, 'apikey.revoked', request, key.name)
    return reply.send({ ok: true })
  })

  // ── Module favorites ─────────────────────────────────────────────────────────
  const favModuleSchema = z.object({ moduleId: z.string().min(1).max(64) })

  app.post('/favorites/modules', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.user as { id: string }
    const { moduleId } = favModuleSchema.parse(request.body)
    const user = await prisma.user.findUnique({ where: { id }, select: { favoriteModules: true } })
    if (!user) return reply.status(404).send({ error: 'Utilisateur introuvable.' })
    const next = user.favoriteModules.includes(moduleId)
      ? user.favoriteModules.filter((m) => m !== moduleId)
      : [...user.favoriteModules, moduleId]
    const updated = await prisma.user.update({ where: { id }, data: { favoriteModules: next }, select: USER_SELECT })
    return reply.send(withAdmin(updated))
  })
}
