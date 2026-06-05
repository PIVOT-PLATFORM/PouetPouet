import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'

interface SessionInfo {
  id: string
  code: string
  status: string
  boardId: string
  board: { name: string; ownerId: string }
}

interface Participant {
  id: string
  guestName: string
}

interface Activity {
  id: string
  type: string
  title: string
  config: Record<string, unknown>
  status: string
}

interface ActivityResponse {
  activityId: string
  responses: unknown[]
}

export type SessionClosedReason = 'host_closed' | null

export function useParticipantSession(code: string) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null)
  const [responses, setResponses] = useState<unknown[]>([])
  const [hasResponded, setHasResponded] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closedByHost, setClosedByHost] = useState(false)
  const socketRef = useRef(connectSocket())

  useEffect(() => {
    api.get<SessionInfo>(`/api/sessions/join/${code}`)
      .then(setSessionInfo)
      .catch(() => setError('Session introuvable ou terminée'))
  }, [code])

  useEffect(() => {
    const socket = socketRef.current

    socket.on('session:joined', ({ session, participant }: { session: SessionInfo; participant: Participant }) => {
      setSessionInfo((prev) => ({ ...(prev ?? {}), ...session, board: session.board ?? prev?.board } as SessionInfo))
      setIsJoined(true)
      try { sessionStorage.setItem(`klx_p_${code}`, JSON.stringify({ participantId: participant.id })) } catch {}
    })

    socket.on('session:rejoined', ({ session }: { session: SessionInfo }) => {
      setSessionInfo((prev) => ({ ...(prev ?? {}), ...session, board: prev?.board } as SessionInfo))
      setIsJoined(true)
    })

    socket.on('session:participant_count', (count: number) => setParticipantCount(count))

    socket.on('activity:launched', (activity: Activity) => {
      setCurrentActivity(activity)
      setHasResponded(false)
      setResponses([])
    })

    socket.on('activity:closed', () => {
      setCurrentActivity(null)
      setHasResponded(false)
      setResponses([])
    })

    socket.on('activity:responses_updated', ({ responses: r }: ActivityResponse) => {
      setResponses(r)
    })

    socket.on('session:closed', () => {
      setClosedByHost(true)
      try { sessionStorage.removeItem(`klx_p_${code}`) } catch {}
    })

    socket.on('error', (msg: string) => setError(msg))
    socket.on('connect_error', () => setError('Connexion impossible. Réessayez dans un instant.'))

    return () => {
      socket.off('session:joined')
      socket.off('session:rejoined')
      socket.off('session:participant_count')
      socket.off('activity:launched')
      socket.off('activity:closed')
      socket.off('activity:responses_updated')
      socket.off('session:closed')
      socket.off('error')
      socket.off('connect_error')
    }
  }, [code])

  // Auto-rejoin on mount if sessionStorage has a participantId for this code
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`klx_p_${code}`)
      if (!stored) return
      const { participantId } = JSON.parse(stored) as { participantId: string }
      socketRef.current.emit('session:rejoin', { participantId })
    } catch {}
  }, [code])

  function join(guestName: string) {
    socketRef.current.emit('session:join', { code, guestName })
  }

  function respond(activityId: string, value: unknown) {
    socketRef.current.emit('activity:respond', { activityId, value })
    setHasResponded(true)
  }

  return {
    sessionInfo, participantCount, currentActivity, responses,
    hasResponded, isJoined, error, closedByHost,
    join, respond,
  }
}
