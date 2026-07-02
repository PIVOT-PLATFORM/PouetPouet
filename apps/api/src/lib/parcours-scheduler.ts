import cron, { type ScheduledTask } from 'node-cron'
import { prisma } from './prisma.js'

// Maps templateId → cron task (pour pouvoir annuler/recréer quand le template change)
const scheduledTasks = new Map<string, ScheduledTask>()

async function fireScheduledTemplate(templateId: string, templateName: string) {
  try {
    const template = await prisma.parcourTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, ownerId: true, steps: true },
    })
    if (!template) return

    const stepCount = Array.isArray(template.steps) ? (template.steps as unknown[]).length : 0

    await prisma.parcourInstance.create({
      data: {
        templateId,
        ownerId: template.ownerId,
        title: `[Auto] ${templateName}`,
        currentStep: 0,
        status: 'IN_PROGRESS',
        steps: {
          create: Array.from({ length: stepCount }, (_, i) => ({
            stepIndex: i,
            status: i === 0 ? 'PENDING' : 'PENDING',
          })),
        },
      },
    })
    console.info(`[parcours-scheduler] instance créée pour template "${templateName}" (${templateId})`)
  } catch (err) {
    console.error(`[parcours-scheduler] erreur pour template ${templateId}:`, err)
  }
}

export function scheduleTemplate(templateId: string, templateName: string, cronExpression: string) {
  unscheduleTemplate(templateId)
  if (!cron.validate(cronExpression)) {
    console.warn(`[parcours-scheduler] expression cron invalide pour "${templateName}": ${cronExpression}`)
    return
  }
  const task = cron.schedule(cronExpression, () => { void fireScheduledTemplate(templateId, templateName) })
  scheduledTasks.set(templateId, task)
  console.info(`[parcours-scheduler] planifié: "${templateName}" [${cronExpression}]`)
}

export function unscheduleTemplate(templateId: string) {
  const existing = scheduledTasks.get(templateId)
  if (existing) {
    existing.stop()
    scheduledTasks.delete(templateId)
  }
}

export async function startScheduler() {
  const templates = await prisma.parcourTemplate.findMany({
    where: { triggerType: 'schedule' },
    select: { id: true, name: true, triggerConfig: true },
  })

  for (const t of templates) {
    const config = (t.triggerConfig ?? {}) as { cronExpression?: string }
    if (config.cronExpression) {
      scheduleTemplate(t.id, t.name, config.cronExpression)
    }
  }

  console.info(`[parcours-scheduler] démarré — ${templates.length} template(s) planifié(s)`)
}
