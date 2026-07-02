import { prisma } from '../../lib/prisma.js'
import { notify } from '../../lib/notify.js'
import { recordEvent } from './signdoc.events.js'
import { canSignNow, isActingRecipient, remindRecipient } from './signdoc.workflow.js'

// Maintenance périodique des enveloppes SignDoc :
//  - expiration des enveloppes dont la date butoir globale est dépassée,
//  - relances des signataires de l'étape active dont l'échéance approche.
// Tourne in-process façon lib/retention.ts ; verrou consultatif Postgres pour
// une seule exécution quand plusieurs instances tournent (#205 — la prod
// mono-instance n'a pas de Redis, la base est toujours disponible).

const HOUR_MS = 3_600_000
const REMIND_WINDOW_MS = 48 * HOUR_MS // relance si l'échéance est à moins de 48 h
const REMIND_COOLDOWN_MS = 20 * HOUR_MS // pas plus d'une relance toutes les 20 h
const TICK_MS = 6 * HOUR_MS

export interface MaintenanceResult {
  expired: number
  reminded: number
  deadlineAlerts: number
}

export async function runSigndocMaintenance(now = new Date()): Promise<MaintenanceResult> {
  let expired = 0
  let reminded = 0
  let deadlineAlerts = 0

  // ── Expiration ────────────────────────────────────────────────────────────
  const overdue = await prisma.signEnvelope.findMany({
    where: { status: { in: ['SENT', 'IN_PROGRESS'] }, globalDeadline: { lt: now } },
    select: { id: true, name: true, ownerId: true },
  })
  for (const env of overdue) {
    await prisma.signEnvelope.update({ where: { id: env.id }, data: { status: 'EXPIRED' } })
    await prisma.signRecipient.updateMany({ where: { envelopeId: env.id, status: { in: ['PENDING', 'SENT', 'VIEWED'] } }, data: { accessTokenHash: null, tokenExpires: null } })
    await recordEvent(env.id, 'expired', { actorLabel: 'system' })
    await notify({ userId: env.ownerId, type: 'SIGN_EXPIRED', title: 'Demande de signature expirée', body: `« ${env.name} » a dépassé sa date limite.`, link: `/signdoc/${env.id}` })
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
      if (!deadline) continue // pas d'échéance
      if (!canSignNow(env, r, env.recipients)) continue // séquentiel : seulement l'étape active

      // Échéance dépassée : alerte le propriétaire (une seule fois) pour qu'il
      // relance ou annule. Le lien du signataire reste valide (TTL découplé).
      if (deadline.getTime() <= now.getTime()) {
        const alerted = await prisma.signEvent.findFirst({
          where: { envelopeId: env.id, recipientId: r.id, type: 'deadline_missed' },
          select: { id: true },
        })
        if (alerted) continue
        await recordEvent(env.id, 'deadline_missed', { actorLabel: 'system', recipientId: r.id })
        await notify({ userId: env.ownerId, type: 'SIGN_EXPIRED', title: 'Échéance de signature dépassée', body: `${r.name} n'a pas signé « ${env.name} » dans les temps.`, link: `/signdoc/${env.id}` })
        deadlineAlerts++
        continue
      }

      if (deadline.getTime() - now.getTime() > REMIND_WINDOW_MS) continue // trop tôt
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

  return { expired, reminded, deadlineAlerts }
}

// Planifie la maintenance : au démarrage (différé) puis toutes les 6 h.
export function scheduleSigndocMaintenance(log: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void }) {
  async function tick() {
    try {
      // Verrou consultatif Postgres (portée transaction) : une seule instance
      // exécute la maintenance, le verrou est relâché automatiquement à la fin
      // de la transaction. La connexion de la transaction ne sert qu'à porter
      // le verrou ; la maintenance elle-même tourne sur le client global.
      await prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('signdoc:maintenance')) AS locked`
          if (!rows[0]?.locked) return // une autre instance s'en charge
          const result = await runSigndocMaintenance()
          if (result.expired || result.reminded || result.deadlineAlerts) log.info({ signdoc: result }, 'signdoc maintenance done')
        },
        { maxWait: 5_000, timeout: 600_000 },
      )
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'signdoc maintenance failed')
    }
  }
  setTimeout(() => void tick(), 90_000)
  setInterval(() => void tick(), TICK_MS)
}
