import type { Server, Socket } from 'socket.io'
import { prisma } from '../lib/prisma.js'

export function sessionSocketHandlers(io: Server, socket: Socket) {
  // L'animateur rejoint la room pour recevoir les mises à jour
  socket.on('session:host_join', async (sessionId: string) => {
    await socket.join(`session:${sessionId}`)
    socket.data.isHost = true
    socket.data.sessionId = sessionId
    const count = await prisma.sessionParticipant.count({ where: { sessionId } })
    socket.emit('session:participant_count', count)
  })

  socket.on('session:join', async (data: { code: string; guestName?: string }) => {
    const session = await prisma.session.findUnique({
      where: { code: data.code },
      include: { board: { select: { name: true, ownerId: true } } },
    })
    if (!session) return socket.emit('error', 'Session introuvable')
    if (session.status === 'CLOSED') return socket.emit('error', 'Session terminée')

    const participant = await prisma.sessionParticipant.create({
      data: { sessionId: session.id, guestName: data.guestName ?? 'Anonyme' },
    })

    await socket.join(`session:${session.id}`)
    socket.data.participantId = participant.id
    socket.data.sessionId = session.id

    const count = await prisma.sessionParticipant.count({ where: { sessionId: session.id } })
    io.to(`session:${session.id}`).emit('session:participant_count', count)
    socket.emit('session:joined', { session, participant })

    // If an activity is already running, send it immediately to the new participant
    const activeActivity = await prisma.activity.findFirst({
      where: { sessionId: session.id, status: 'ACTIVE' },
    })
    if (activeActivity) socket.emit('activity:launched', activeActivity)
  })

  socket.on('activity:launch', async (data: { sessionId: string; type: string; title: string; config: object }) => {
    const activity = await prisma.activity.create({
      data: {
        sessionId: data.sessionId,
        type: data.type as never,
        title: data.title,
        config: data.config,
        status: 'ACTIVE',
      },
    })
    io.to(`session:${data.sessionId}`).emit('activity:launched', activity)
  })

  socket.on('activity:close', async (activityId: string) => {
    await prisma.activity.update({ where: { id: activityId }, data: { status: 'CLOSED' } })
    const sessionId = socket.data.sessionId as string
    io.to(`session:${sessionId}`).emit('activity:closed', activityId)
  })

  socket.on('activity:respond', async (data: { activityId: string; value: unknown }) => {
    const participantId = socket.data.participantId as string
    if (!participantId) return socket.emit('error', 'Non connecté à une session')

    await prisma.activityResponse.create({
      data: { activityId: data.activityId, participantId, value: data.value as never },
    })

    const sessionId = socket.data.sessionId as string
    const allResponses = await prisma.activityResponse.findMany({
      where: { activityId: data.activityId },
    })
    io.to(`session:${sessionId}`).emit('activity:responses_updated', {
      activityId: data.activityId,
      responses: allResponses,
    })
  })

  socket.on('disconnect', async () => {
    const sessionId = socket.data.sessionId as string | undefined
    const isHost = socket.data.isHost as boolean | undefined
    if (!sessionId || isHost) return
    const count = await prisma.sessionParticipant.count({ where: { sessionId } })
    io.to(`session:${sessionId}`).emit('session:participant_count', count)
  })
}
