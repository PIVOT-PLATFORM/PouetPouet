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

export function useSession(boardId: string) {
  const [session, setSession] = useState<Session | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null)
  const [activityResponses, setActivityResponses] = useState<unknown[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const socketRef = useRef(connectSocket())

  useEffect(() => {
    const socket = socketRef.current

    socket.on('session:participant_count', (count: number) => setParticipantCount(count))
    socket.on('activity:launched', (activity: Activity) => {
      setCurrentActivity(activity)
      setActivityResponses([])
    })
    socket.on('activity:closed', () => {
      setCurrentActivity(null)
      setActivityResponses([])
    })
    socket.on('activity:responses_updated', ({ responses }: { activityId: string; responses: unknown[] }) => {
      setActivityResponses(responses)
    })

    return () => {
      socket.off('session:participant_count')
      socket.off('activity:launched')
      socket.off('activity:closed')
      socket.off('activity:responses_updated')
    }
  }, [])

  async function startSession() {
    setIsLoading(true)
    try {
      const s = await api.post<Session>('/api/sessions', { boardId })
      setSession(s)
      setParticipantCount(0)
      socketRef.current.emit('session:host_join', s.id)
    } finally {
      setIsLoading(false)
    }
  }

  async function closeSession() {
    if (!session) return
    await api.patch(`/api/sessions/${session.id}/close`, {})
    setSession(null)
    setParticipantCount(0)
    setCurrentActivity(null)
    setActivityResponses([])
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
    isLoading,
    startSession,
    closeSession,
    launchActivity,
    closeActivity,
  }
}
