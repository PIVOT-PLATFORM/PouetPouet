import { prisma } from './prisma.js'
import { getIO } from './io.js'

export type NotificationType =
  | 'BOARD_SHARED'
  | 'ROLE_CHANGED'
  | 'ACCESS_REVOKED'
  | 'BOARD_DELETED'
  | 'DAILY_SESSION_ENDED'
  | 'SCRUM_ALL_ESTIMATED'
  | 'WHEEL_DRAW'
  | 'BOARD_IMPORTED'
  | 'MODULE_SHARED'
  | 'PARCOURS_STEP_ASSIGNED'
  | 'PARCOURS_STEP_COMPLETED'
  | 'PARCOURS_INSTANCE_COMPLETED'
  | 'PARCOURS_NOTIFICATION'

interface NotifyInput {
  userId: string
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
}

// Persists an activity notification for a user and pushes it live over the
// per-user socket room (`user:<id>`). Failures are swallowed so a notification
// never breaks the action that triggered it.
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
      },
    })
    getIO()?.to(`user:${input.userId}`).emit('notification:new', notification)
  } catch (err) {
    console.error('notify() failed', err)
  }
}
