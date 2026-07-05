import { prisma } from '../../lib/prisma.js'
import { notify } from '../../lib/notify.js'
import { sendFormReminderEmail } from '../../lib/mailer.js'
import { closedReason } from './forms-validate.js'

// Relances automatiques des destinataires nommés n'ayant pas répondu, au rythme
// paramétré par formulaire (reminderFrequencyDays). Tourne in-process façon
// signdoc.scheduler.ts ; verrou consultatif Postgres pour une seule exécution
// quand plusieurs instances tournent.

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'
const HOUR_MS = 3_600_000
const REMIND_COOLDOWN_MS = 20 * HOUR_MS // garde-fou dur, indépendant de la fréquence paramétrée
const TICK_MS = HOUR_MS
const SEND_WINDOW_START_HOUR = 8
const SEND_WINDOW_END_HOUR = 18

export interface FormReminderResult {
  reminded: number
}

export async function runFormReminders(now = new Date()): Promise<FormReminderResult> {
  let reminded = 0
  const hour = now.getHours()
  if (hour < SEND_WINDOW_START_HOUR || hour >= SEND_WINDOW_END_HOUR) return { reminded } // hors fenêtre d'envoi

  const forms = await prisma.form.findMany({
    where: { remindersEnabled: true },
    include: {
      recipients: { where: { respondedAt: null, invitedAt: { not: null } } },
      _count: { select: { responses: true } },
    },
  })

  for (const form of forms) {
    // Formulaire fermé (manuel / date / plafond) : arrêt naturel des relances.
    if (closedReason(form, form._count.responses, now)) continue

    let batch = 0
    for (const r of form.recipients) {
      const last = r.lastRemindedAt ?? r.invitedAt!
      const dueMs = form.reminderFrequencyDays * 24 * HOUR_MS
      if (now.getTime() - last.getTime() < dueMs) continue
      if (r.lastRemindedAt && now.getTime() - r.lastRemindedAt.getTime() < REMIND_COOLDOWN_MS) continue

      const link = `${FRONTEND_URL}/f/${r.token}`
      await sendFormReminderEmail(r.email, r.name, form.title, link).catch(() => {})
      await prisma.formRecipient.update({ where: { id: r.id }, data: { lastRemindedAt: now, remindersSent: { increment: 1 } } })
      reminded++
      batch++
    }
    if (batch > 0) {
      await notify({
        userId: form.ownerId,
        type: 'FORM_REMINDERS_SENT',
        title: 'Relances envoyées',
        body: `${batch} relance(s) envoyée(s) pour « ${form.title} ».`,
        link: `/forms/${form.id}/responses`,
      })
    }
  }

  return { reminded }
}

// Planifie les relances : au démarrage (différé) puis toutes les heures.
export function scheduleFormReminders(log: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void }) {
  async function tick() {
    try {
      await prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('forms:reminders')) AS locked`
          if (!rows[0]?.locked) return // une autre instance s'en charge
          const result = await runFormReminders()
          if (result.reminded) log.info({ forms: result }, 'form reminders sent')
        },
        { maxWait: 5_000, timeout: 600_000 },
      )
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'form reminders failed')
    }
  }
  setTimeout(() => void tick(), 90_000)
  setInterval(() => void tick(), TICK_MS)
}
