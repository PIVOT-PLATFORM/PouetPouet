import type { Server, Socket } from 'socket.io'
import { prisma } from '../lib/prisma.js'

function getParticipantCount(io: Server, sessionId: string): number {
  const room = io.sockets.adapter.rooms.get(`session:${sessionId}`)
  if (!room) return 0
  let count = 0
  for (const socketId of room) {
    const s = io.sockets.sockets.get(socketId)
    if (s && !s.data.isHost) count++
  }
  return count
}

export function sessionSocketHandlers(io: Server, socket: Socket) {
  // ── Animateur : rejoint la room et notifie le board que la session est active ──
  socket.on('session:host_join', async (sessionId: string) => {
    const userId = socket.data.userId as string | undefined
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { boardId: true, code: true, board: { select: { ownerId: true } } },
    })
    if (!session) return
    // Hôte = propriétaire/co-propriétaire OU éditeur du board (matrice des rôles)
    let canHost = session.board.ownerId === userId
    if (!canHost && userId) {
      const share = await prisma.boardShare.findUnique({
        where: { boardId_userId: { boardId: session.boardId, userId } },
        select: { role: true },
      })
      canHost = share?.role === 'OWNER' || share?.role === 'EDITOR'
    }
    if (!canHost) return socket.emit('error', 'Accès refusé')

    await socket.join(`session:${sessionId}`)
    socket.data.isHost = true
    socket.data.sessionId = sessionId
    socket.data.boardId = session.boardId

    socket.emit('session:participant_count', getParticipantCount(io, sessionId))
    io.to(`board:${session.boardId}`).emit('session:started', { sessionId, code: session.code })
  })

  // ── Membre authentifié du board : rejoint en tant que participant ─────────────
  socket.on('session:member_join', async (sessionId: string) => {
    const userId = socket.data.userId as string | undefined
    if (!userId) return socket.emit('error', 'Non authentifié')

    const session = await prisma.session.findUnique({ where: { id: sessionId } })
    if (!session || session.status === 'CLOSED') return socket.emit('error', 'Session introuvable ou terminée')

    // Find or create participant (avoid duplicates across refreshes)
    let participant = await prisma.sessionParticipant.findFirst({
      where: { sessionId, userId },
    })
    if (!participant) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
      participant = await prisma.sessionParticipant.create({
        data: { sessionId, userId, guestName: user?.name ?? 'Membre' },
      })
    }

    await socket.join(`session:${sessionId}`)
    socket.data.participantId = participant.id
    socket.data.sessionId = sessionId

    socket.emit('session:joined', { session, participant })
    io.to(`session:${sessionId}`).emit('session:participant_count', getParticipantCount(io, sessionId))

    const activeActivity = await prisma.activity.findFirst({
      where: { sessionId, status: 'ACTIVE' },
    })
    if (activeActivity) socket.emit('activity:launched', activeActivity)
  })

  // ── Participant anonyme : rejoint avec son participantId (après refresh) ──────
  socket.on('session:rejoin', async (data: { participantId: string }) => {
    const participant = await prisma.sessionParticipant.findUnique({
      where: { id: data.participantId },
    })
    if (!participant) return socket.emit('error', 'Participant introuvable')

    const session = await prisma.session.findUnique({ where: { id: participant.sessionId } })
    if (!session || session.status === 'CLOSED') return socket.emit('error', 'Session terminée')

    await socket.join(`session:${participant.sessionId}`)
    socket.data.participantId = participant.id
    socket.data.sessionId = participant.sessionId

    socket.emit('session:rejoined', { session, participant })
    io.to(`session:${participant.sessionId}`).emit('session:participant_count', getParticipantCount(io, participant.sessionId))

    const activeActivity = await prisma.activity.findFirst({
      where: { sessionId: participant.sessionId, status: 'ACTIVE' },
    })
    if (activeActivity) socket.emit('activity:launched', activeActivity)
  })

  // ── Participant anonyme : premier join ────────────────────────────────────────
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

    socket.emit('session:joined', { session, participant })
    io.to(`session:${session.id}`).emit('session:participant_count', getParticipantCount(io, session.id))

    const activeActivity = await prisma.activity.findFirst({
      where: { sessionId: session.id, status: 'ACTIVE' },
    })
    if (activeActivity) socket.emit('activity:launched', activeActivity)
  })

  // ── Lancer une activité ───────────────────────────────────────────────────────
  socket.on('activity:launch', async (data: { sessionId: string; type: string; title: string; config: object }) => {
    if (!socket.data.isHost) return socket.emit('error', 'Accès refusé')
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

  // ── Fermer une activité ───────────────────────────────────────────────────────
  // Le rapport final (activité + réponses) part avec l'événement de clôture :
  // hôte ET participants affichent les résultats au lieu de tout effacer.
  socket.on('activity:close', async (activityId: string) => {
    if (!socket.data.isHost) return socket.emit('error', 'Accès refusé')
    const activity = await prisma.activity.update({ where: { id: activityId }, data: { status: 'CLOSED' } })
    const responses = await prisma.activityResponse.findMany({ where: { activityId } })
    const sessionId = socket.data.sessionId as string
    io.to(`session:${sessionId}`).emit('activity:closed', { activityId, activity, responses })
  })

  // ── Fermer la session (remplace le HTTP PATCH) ────────────────────────────────
  socket.on('session:close', async (sessionId: string) => {
    if (!socket.data.isHost) return socket.emit('error', 'Accès refusé')
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: { status: 'CLOSED', closedAt: new Date() },
      select: { boardId: true },
    })
    io.to(`session:${sessionId}`).emit('session:closed')
    io.to(`board:${session.boardId}`).emit('session:closed')
  })

  // ── Répondre à une activité ───────────────────────────────────────────────────
  socket.on('activity:respond', async (data: { activityId: string; value: unknown }) => {
    const participantId = socket.data.participantId as string
    if (!participantId) return socket.emit('error', 'Non connecté à une session')

    // Prevent duplicate responses
    const existing = await prisma.activityResponse.findFirst({
      where: { activityId: data.activityId, participantId },
    })
    if (existing) return

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

  // ── Déconnexion ───────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const sessionId = socket.data.sessionId as string | undefined
    const isHost = socket.data.isHost as boolean | undefined
    if (!sessionId || isHost) return
    // Broadcast live count (socket is already removed from room at this point)
    io.to(`session:${sessionId}`).emit('session:participant_count', getParticipantCount(io, sessionId))
  })
}
