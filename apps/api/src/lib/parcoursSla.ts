import { prisma } from './prisma.js'
import { redis } from './redis.js'
import { notify } from './notify.js'
import { sendParcoursReminderEmail } from './mailer.js'

const HOUR_MS = 60 * 60 * 1000
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000'

// Cherche les étapes en retard ou proches de l'échéance et envoie des rappels.
// Tourne toutes les heures. Verrou Redis pour éviter les doublons si plusieurs
// instances Cloud Run tournent.
export async function runParcoursSla(now = new Date()): Promise<{ reminded: number; overdue: number }> {
  // Étapes dont l'échéance est dépassée ou dans moins de 24h, encore PENDING
  const overdueSteps = await prisma.parcourStepInstance.findMany({
    where: {
      status: 'PENDING',
      dueAt: { not: null, lte: new Date(now.getTime() + 24 * HOUR_MS) },
      // Ne pas re-rappeler si déjà notifié dans les dernières 20h
      OR: [
        { notifiedAt: null },
        { notifiedAt: { lte: new Date(now.getTime() - 20 * HOUR_MS) } },
      ],
    },
    include: {
      instance: {
        select: {
          id: true,
          title: true,
          refNumber: true,
          remindByEmail: true,
          ownerId: true,
          owner: { select: { email: true } },
          template: { select: { steps: true } },
        },
      },
    },
    take: 200,
  })

  let reminded = 0
  let overdue = 0

  for (const step of overdueSteps) {
    const instance = step.instance
    const isOverdue = step.dueAt! <= now
    if (isOverdue) overdue++

    const steps = Array.isArray(instance.template.steps)
      ? instance.template.steps as { title?: string; assignedTo?: string }[]
      : []
    const stepDef = steps[step.stepIndex]
    const stepTitle = stepDef?.title ?? `Étape ${step.stepIndex + 1}`
    const link = `${FRONTEND_URL}/parcours/run/${instance.id}`

    // Notifier l'assigné s'il y en a un, sinon le propriétaire
    const recipientId = step.assignedTo ?? instance.ownerId
    await notify({
      userId: recipientId,
      type: 'PARCOURS_STEP_ASSIGNED',
      title: isOverdue
        ? `⚠️ Étape en retard : "${stepTitle}" — ${instance.title}`
        : `Rappel : "${stepTitle}" échoit bientôt — ${instance.title}`,
      link,
    })

    // Email si remindByEmail activé
    if (instance.remindByEmail) {
      // step.assignedTo est un userId — résoudre l'email réel avant envoi
      let emailTarget = instance.owner.email
      if (step.assignedTo) {
        const assignee = await prisma.user.findUnique({ where: { id: step.assignedTo }, select: { email: true } })
        if (assignee?.email) emailTarget = assignee.email
      }
      await sendParcoursReminderEmail(
        emailTarget,
        instance.title,
        stepTitle,
        instance.refNumber,
        link,
      ).catch(() => {})
    }

    // Marquer comme notifié pour éviter le spam
    await prisma.parcourStepInstance.update({
      where: { id: step.id },
      data: { notifiedAt: now },
    })

    reminded++
  }

  return { reminded, overdue }
}

export function scheduleParcoursSla(log: { info: (obj: object, msg: string) => void; warn: (obj: object, msg: string) => void }) {
  async function tick() {
    try {
      if (redis.status === 'ready') {
        const acquired = await redis.set('parcours:sla:lock', '1', 'EX', 3600, 'NX')
        if (!acquired) return
      }
      const result = await runParcoursSla()
      if (result.reminded > 0) {
        log.info({ sla: result }, 'parcours SLA check done')
      }
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'parcours SLA check failed')
    }
  }
  // Démarrage différé (2 min) puis toutes les heures
  setTimeout(() => void tick(), 2 * 60_000)
  setInterval(() => void tick(), HOUR_MS)
}
