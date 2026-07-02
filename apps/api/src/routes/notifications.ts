import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PATCH_NOTES } from '../lib/patch-notes.js'

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authenticate)

  // Full payload for the notifications panel: activity feed + patch notes + read state.
  app.get('/', async (request) => {
    const { id: userId } = request.user as { id: string }
    const [activity, user] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { patchNotesSeenAt: true, patchNotesSeenVersion: true } }),
    ])
    const unreadActivity = activity.filter((n) => n.readAt === null).length
    const patchNotesSeenAt = user?.patchNotesSeenAt ?? null
    const patchNotesSeenVersion = user?.patchNotesSeenVersion ?? null
    // Comparaison par version, pas par date : deux releases le même jour doivent
    // chacune rallumer la pastille (#219).
    const hasUnreadPatchNotes =
      PATCH_NOTES.length > 0 && PATCH_NOTES[0].version !== patchNotesSeenVersion
    return {
      activity,
      unreadActivity,
      patchNotes: PATCH_NOTES,
      patchNotesSeenAt,
      patchNotesSeenVersion,
      hasUnreadPatchNotes,
    }
  })

  // Mark a single activity notification as read (scoped to the caller).
  app.post('/:id/read', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    await prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    })
    return reply.send({ ok: true })
  })

  // Mark every unread activity notification as read.
  app.post('/read-all', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    })
    return reply.send({ ok: true })
  })

  // Remove a single notification.
  app.delete('/:id', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    const { id } = request.params as { id: string }
    await prisma.notification.deleteMany({ where: { id, userId } })
    return reply.status(204).send()
  })

  // Acknowledge the patch notes: clears the "new release" indicator.
  app.post('/patch-notes/seen', async (request, reply) => {
    const { id: userId } = request.user as { id: string }
    await prisma.user.update({
      where: { id: userId },
      data: { patchNotesSeenAt: new Date(), patchNotesSeenVersion: PATCH_NOTES[0]?.version ?? null },
    })
    return reply.send({ ok: true })
  })
}
