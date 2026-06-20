import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'

export interface Session {
  id: string
  boardId: string
  code: string
  status: 'WAITING' | 'ACTIVE' | 'CLOSED'
}

export interface Activity {
  id: string
  sessionId: string
  type: 'POLL' | 'WORDCLOUD' | 'BRAINSTORM' | 'QUIZ'
  title: string
  config: Record<string, unknown>
  status: string
}

const LS_KEY = 'klx_host_session'

export function useSession(boardId: string) {
  const [session, setSession] = useState<Session | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null)
  const [activityResponses, setActivityResponses] = useState<unknown[]>([])
  // Rapport de la dernière activité clôturée (affiché jusqu'à fermeture/nouvelle activité)
  const [lastReport, setLastReport] = useState<{ activity: Activity; responses: unknown[] } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const socketRef = useRef(connectSocket())
  const sessionRef = useRef<Session | null>(null)
  sessionRef.current = session

  useEffect(() => {
    const socket = socketRef.current

    const onParticipantCount = (count: number) => setParticipantCount(count)
    const onActivityLaunched = (activity: Activity) => {
      setCurrentActivity(activity)
      setActivityResponses([])
      setLastReport(null)
    }
    const onActivityClosed = (payload: { activity?: Activity; responses?: unknown[] } | string) => {
      // Le serveur joint le rapport final ; on le conserve pour affichage.
      if (typeof payload === 'object' && payload.activity) {
        setLastReport({ activity: payload.activity, responses: payload.responses ?? [] })
      }
      setCurrentActivity(null)
      setActivityResponses([])
    }
    const onActivityResponsesUpdated = ({ responses }: { activityId: string; responses: unknown[] }) => {
      setActivityResponses(responses)
    }
    const onSessionClosed = () => {
      setSession(null)
      setParticipantCount(0)
      setCurrentActivity(null)
      setActivityResponses([])
      try { localStorage.removeItem(LS_KEY) } catch {}
    }

    socket.on('session:participant_count', onParticipantCount)
    socket.on('activity:launched', onActivityLaunched)
    socket.on('activity:closed', onActivityClosed)
    socket.on('activity:responses_updated', onActivityResponsesUpdated)
    socket.on('session:closed', onSessionClosed)

    // On reconnect, re-join the session room if one was active
    const handleReconnect = () => {
      if (sessionRef.current) {
        socket.emit('session:host_join', sessionRef.current.id)
      }
    }
    socket.io.on('reconnect', handleReconnect)

    return () => {
      socket.off('session:participant_count', onParticipantCount)
      socket.off('activity:launched', onActivityLaunched)
      socket.off('activity:closed', onActivityClosed)
      socket.off('activity:responses_updated', onActivityResponsesUpdated)
      socket.off('session:closed', onSessionClosed)
      socket.io.off('reconnect', handleReconnect)
    }
  }, [])

  // Auto-rejoin host session on mount (after refresh)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (!stored) return
      const { sessionId, boardId: storedBoardId } = JSON.parse(stored) as { sessionId: string; boardId: string }
      if (storedBoardId !== boardId) return
      api.get<Session>(`/api/sessions/${sessionId}`)
        .then((s) => {
          setSession(s)
          socketRef.current.emit('session:host_join', s.id)
        })
        .catch(() => {
          try { localStorage.removeItem(LS_KEY) } catch {}
        })
    } catch {}
  }, [boardId])

  async function startSession() {
    setIsLoading(true)
    try {
      const s = await api.post<Session>('/api/sessions', { boardId })
      setSession(s)
      setParticipantCount(0)
      socketRef.current.emit('session:host_join', s.id)
      try { localStorage.setItem(LS_KEY, JSON.stringify({ sessionId: s.id, boardId })) } catch {}
    } finally {
      setIsLoading(false)
    }
  }

  function closeSession() {
    if (!session) return
    socketRef.current.emit('session:close', session.id)
    setSession(null)
    setParticipantCount(0)
    setCurrentActivity(null)
    setActivityResponses([])
    try { localStorage.removeItem(LS_KEY) } catch {}
  }

  function launchActivity(type: Activity['type'], title: string, config: Record<string, unknown>) {
    if (!session) return
    socketRef.current.emit('activity:launch', { sessionId: session.id, type, title, config })
  }

  function closeActivity() {
    if (!currentActivity) return
    socketRef.current.emit('activity:close', currentActivity.id)
  }

  return {
    session,
    participantCount,
    currentActivity,
    activityResponses,
    lastReport,
    clearLastReport: () => setLastReport(null),
    isLoading,
    startSession,
    closeSession,
    launchActivity,
    closeActivity,
  }
}
