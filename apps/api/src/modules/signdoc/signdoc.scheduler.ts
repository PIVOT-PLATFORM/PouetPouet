import { prisma } from '../../lib/prisma.js'
import { redis } from '../../lib/redis.js'
import { notify } from '../../lib/notify.js'
import { recordEvent } from './signdoc.events.js'
import { canSignNow, isActingRecipient, remindRecipient } from './signdoc.workflow.js'

// Maintenance périodique des enveloppes SignDoc :
//  - expiration des enveloppes dont la date butoir globale est dépassée,
//  - relances des signataires de l'étape active dont l'échéance approche.
// Tourne in-process façon lib/retention.ts ; verrou Redis pour une seule
// exécution quand plusieurs instances tournent.

const HOUR_MS = 3_600_000
const REMIND_WINDOW_MS = 48 * HOUR_MS // relance si l'échéance est à moins de 48 h
const REMIND_COOLDOWN_MS = 20 * HOUR_MS // pas plus d'une relance toutes les 20 h
const TICK_MS = 6 * HOUR_MS

export interface MaintenanceResult {
  expired: number
  reminded: number
}

export async function runSigndocMaintenance(now = new Date()): Promise<MaintenanceResult> {
  let expired = 0
  let reminded = 0

  // ── Expiration ────────────────────────────────────────────────────────────
  const overdue = await prisma.signEnvelope.findMany({
    where: { status: { in: ['SENT', 'IN_PROGRESS'] }, globalDeadline: { lt: now } },
    select: { id: true, name: true, ownerId: true },
  })
  for (const env of overdue) {
    await prisma.signEnvelope.update({ where: { id: env.id }, data: { status: 'EXPIRED' } })
    await prisma.signRecipient.updateMany({ where: { envelopeId: env.id, status: { in: ['PENDING', 'SENT', 'VIEWED'] } }, data: { accessTokenHash: null, tokenExpires: null } })
    await recordEvent(env.id, 'expired', { actorLabel: 'system' })
    await notify({ userId: env.ownerId, type: 'SIGN_DECLINED', title: 'Demande de signature expirée', body: `« ${env.name} » a dépassé sa date limite.`, link: `/signdoc/${env.id}` })
    expired++
  }

  // ── Relances ──────────────────────────────────────────────────────────────
  const active = await prisma.signEnvelope.findMany({
    where: { status: { in: ['SENT', 'IN_PROGRESS'] } },
    include: { recipients: true },
  })
  for (const env of active) {
    for (const r of env.recipients) {
      if (!isActingRecipient(r) || (r.status !== 'SENT' && r.status !== 'VIEWED')) continue
      const deadline = r.deadline ?? env.globalDeadline
      if (!deadline || deadline.getTime() <= now.getTime()) continue // pas d'échéance ou déjà dépassée
      if (deadline.getTime() - now.getTime() > REMIND_WINDOW_MS) continue // trop tôt
      if (!canSignNow(env, r, env.recipients)) continue // séquentiel : seulement l'étape active
      const last = await prisma.signEvent.findFirst({
        where: { envelopeId: env.id, recipientId: r.id, type: 'reminded' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      if (last && now.getTime() - last.createdAt.getTime() < REMIND_COOLDOWN_MS) continue // cooldown
      await remindRecipient(env, r)
      reminded++
    }
  }

  return { expired, reminded }
}

// Planifie la maintenance : au démarrage (différé) puis toutes les 6 h.
export function scheduleSigndocMaintenance(log: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void }) {
  async function tick() {
    try {
      if (redis.status === 'ready') {
        const acquired = await redis.set('signdoc:maintenance:lock', '1', 'EX', 3600, 'NX')
        if (!acquired) return
      }
      const result = await runSigndocMaintenance()
      if (result.expired || result.reminded) log.info({ signdoc: result }, 'signdoc maintenance done')
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'signdoc maintenance failed')
    }
  }
  setTimeout(() => void tick(), 90_000)
  setInterval(() => void tick(), TICK_MS)
}
