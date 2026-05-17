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

export function useParticipantSession(code: string) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null)
  const [responses, setResponses] = useState<unknown[]>([])
  const [hasResponded, setHasResponded] = useState(false)
  const [isJoined, setIsJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef(connectSocket())

  useEffect(() => {
    api.get<SessionInfo>(`/api/sessions/join/${code}`)
      .then(setSessionInfo)
      .catch(() => setError('Session introuvable ou terminée'))
  }, [code])

  useEffect(() => {
    const socket = socketRef.current

    socket.on('session:joined', ({ session }: { session: SessionInfo }) => {
      // Merge to preserve board data if the socket payload doesn't include it
      setSessionInfo((prev) => ({ ...(prev ?? {}), ...session, board: session.board ?? prev?.board } as SessionInfo))
      setIsJoined(true)
    })

    socket.on('session:participant_count', (count: number) => {
      setParticipantCount(count)
    })

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

    socket.on('error', (msg: string) => setError(msg))

    return () => {
      socket.off('session:joined')
      socket.off('session:participant_count')
      socket.off('activity:launched')
      socket.off('activity:closed')
      socket.off('activity:responses_updated')
      socket.off('error')
    }
  }, [])

  function join(guestName: string) {
    socketRef.current.emit('session:join', { code, guestName })
  }

  function respond(activityId: string, value: unknown) {
    socketRef.current.emit('activity:respond', { activityId, value })
    setHasResponded(true)
  }

  return { sessionInfo, participantCount, currentActivity, responses, hasResponded, isJoined, error, join, respond }
}
