import { prisma } from './prisma.js'
import { redis } from './redis.js'

// Politique de rétention — purge périodique des données inactives (RGPD,
// minimisation). Tourne in-process : une instance unique suffit aujourd'hui ;
// le verrou Redis évite les doubles purges si plusieurs instances arrivent (F4).

const DAY_MS = 24 * 60 * 60 * 1000

export const RETENTION_DAYS = {
  closedSessions: 30, // sessions live fermées (participants/activités en cascade)
  readNotifications: 90, // notifications lues
  auditLogs: 180, // journal de sécurité
} as const

export interface RetentionResult {
  closedSessions: number
  readNotifications: number
  auditLogs: number
  expiredTokens: number
}

export async function runRetention(now = new Date()): Promise<RetentionResult> {
  const cutoff = (days: number) => new Date(now.getTime() - days * DAY_MS)

  const [sessions, notifications, auditLogs, verifyTokens, resetTokens] = await prisma.$transaction([
    prisma.session.deleteMany({
      where: { status: 'CLOSED', closedAt: { lt: cutoff(RETENTION_DAYS.closedSessions) } },
    }),
    prisma.notification.deleteMany({
      where: { readAt: { not: null }, createdAt: { lt: cutoff(RETENTION_DAYS.readNotifications) } },
    }),
    prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff(RETENTION_DAYS.auditLogs) } },
    }),
    // Tokens de vérification / reset expirés : on efface le token, pas le compte.
    prisma.user.updateMany({
      where: { verifyTokenExpires: { lt: now } },
      data: { verifyToken: null, verifyTokenExpires: null },
    }),
    prisma.user.updateMany({
      where: { resetTokenExpires: { lt: now } },
      data: { resetToken: null, resetTokenExpires: null },
    }),
  ])

  return {
    closedSessions: sessions.count,
    readNotifications: notifications.count,
    auditLogs: auditLogs.count,
    expiredTokens: verifyTokens.count + resetTokens.count,
  }
}

// Lance la purge au démarrage (différée) puis toutes les 24 h.
// Le verrou Redis (NX, TTL 1 h) garantit une seule purge par fenêtre
// quand plusieurs instances tournent ; sans Redis on exécute directement.
export function scheduleRetention(log: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void }) {
  async function tick() {
    try {
      if (redis.status === 'ready') {
        const acquired = await redis.set('retention:lock', '1', 'EX', 3600, 'NX')
        if (!acquired) return
      }
      const result = await runRetention()
      log.info({ retention: result }, 'retention purge done')
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'retention purge failed')
    }
  }
  setTimeout(() => void tick(), 60_000)
  setInterval(() => void tick(), DAY_MS)
}
