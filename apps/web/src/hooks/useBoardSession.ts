import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'
import type { Activity } from './useSession'

interface ActiveSession {
  id: string
  code: string
}

export function useBoardSession(boardId: string, userId: string | undefined, isOwner: boolean) {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null)
  const [hasResponded, setHasResponded] = useState(false)
  const socketRef = useRef(connectSocket())
  const sessionIdRef = useRef<string | null>(null)

  // Check for an already-running session on mount
  useEffect(() => {
    if (!userId || isOwner) return
    api.get<ActiveSession | null>(`/api/sessions/active?boardId=${boardId}`)
      .then((s) => {
        if (s) {
          setActiveSession(s)
          sessionIdRef.current = s.id
          socketRef.current.emit('session:member_join', s.id)
        }
      })
      .catch(() => {})
  }, [boardId, userId, isOwner])

  useEffect(() => {
    if (!userId || isOwner) return
    const socket = socketRef.current

    socket.on('session:started', ({ sessionId, code }: { sessionId: string; code: string }) => {
      setActiveSession({ id: sessionId, code })
      sessionIdRef.current = sessionId
      socket.emit('session:member_join', sessionId)
    })

    socket.on('activity:launched', (activity: Activity) => {
      // Only handle if we're in this session
      if (!sessionIdRef.current) return
      setCurrentActivity(activity)
      setHasResponded(false)
    })

    socket.on('activity:closed', () => {
      setCurrentActivity(null)
      setHasResponded(false)
    })

    socket.on('session:closed', () => {
      setActiveSession(null)
      setCurrentActivity(null)
      setHasResponded(false)
      sessionIdRef.current = null
    })

    const handleReconnect = () => {
      if (sessionIdRef.current) {
        socket.emit('session:member_join', sessionIdRef.current)
      }
    }
    socket.io.on('reconnect', handleReconnect)

    return () => {
      socket.off('session:started')
      socket.off('activity:launched')
      socket.off('activity:closed')
      socket.off('session:closed')
      socket.io.off('reconnect', handleReconnect)
    }
  }, [userId, isOwner])

  function respond(activityId: string, value: unknown) {
    socketRef.current.emit('activity:respond', { activityId, value })
    setHasResponded(true)
  }

  return { activeSession, currentActivity, hasResponded, respond }
}
