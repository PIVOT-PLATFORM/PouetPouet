import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'

export interface DailyTeamMember {
  id: string
  teamId: string
  name: string
  order: number
}

export interface DailyTeam {
  id: string
  name: string
  ownerId: string
  color: string
  description: string | null
  members: DailyTeamMember[]
  _count?: { dailySessions: number; wheelDraws: number; scrumRooms: number; capacityEvents: number }
  role?: 'OWNER' | 'EDITOR' | 'VIEWER'
  createdAt: string
  updatedAt: string
}

export type DailyParticipantStatus = 'WAITING' | 'SPEAKING' | 'DONE' | 'SKIPPED'
export type DailyStatus = 'PENDING' | 'RUNNING' | 'DONE'

export interface DailyParticipant {
  id: string
  sessionId: string
  name: string
  order: number
  speakingAt: string | null
  doneSpeaking: string | null
  status: DailyParticipantStatus
}

export interface DailySession {
  id: string
  name: string
  ownerId: string
  teamId: string | null
  timePerPerson: number
  status: DailyStatus
  currentIndex: number
  startedAt: string | null
  endedAt: string | null
  participants: DailyParticipant[]
  role?: 'OWNER' | 'EDITOR' | 'VIEWER'
  createdAt: string
  updatedAt: string
}

// ── Teams hook ────────────────────────────────────────────────────────────────

export function useTeams() {
  const [teams, setTeams] = useState<DailyTeam[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<DailyTeam[]>('/api/teams').then((t) => {
      setTeams(t)
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [])

  const createTeam = useCallback(async (name: string, members: string[], color?: string, description?: string) => {
    const team = await api.post<DailyTeam>('/api/teams', { name, members, color, description })
    setTeams((prev) => [...prev, team])
    return team
  }, [])

  const updateTeam = useCallback(async (id: string, name: string, members: string[], color?: string, description?: string) => {
    const team = await api.put<DailyTeam>(`/api/teams/${id}`, { name, members, color, description })
    // Le PUT ne renvoie pas le `role` (annoté seulement dans GET /) : on conserve
    // celui déjà connu pour ne pas faire régresser l'affichage (badge / actions).
    setTeams((prev) => prev.map((t) => (t.id === id ? { ...team, role: t.role } : t)))
    return team
  }, [])

  const deleteTeam = useCallback(async (id: string) => {
    await api.delete(`/api/teams/${id}`)
    setTeams((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { teams, isLoading, createTeam, updateTeam, deleteTeam }
}

// ── Sessions list hook ────────────────────────────────────────────────────────

export function useDailySessions() {
  const [sessions, setSessions] = useState<DailySession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<DailySession[]>('/api/daily/sessions').then((s) => {
      setSessions(s)
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [])

  const createSession = useCallback(async (name: string, timePerPerson: number, participants: string[], teamId?: string) => {
    const session = await api.post<DailySession>('/api/daily/sessions', { name, timePerPerson, participants, teamId })
    setSessions((prev) => [session, ...prev])
    return session
  }, [])

  const deleteSession = useCallback(async (id: string) => {
    await api.delete(`/api/daily/sessions/${id}`)
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  return { sessions, isLoading, createSession, deleteSession }
}

// ── Session runner hook ───────────────────────────────────────────────────────

export function useDailySession(sessionId: string) {
  const [session, setSession] = useState<DailySession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const socketRef = useRef(connectSocket())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Store sessionId in a ref so the connect handler always has the latest value
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  useEffect(() => {
    const socket = socketRef.current

    function joinSession() {
      socket.emit('daily:host_join', sessionIdRef.current)
    }

    socket.on('connect', joinSession)
    socket.on('daily:state', (s: DailySession) => {
      setSession(s)
      setIsLoading(false)
    })

    // Emit immediately if already connected; otherwise the connect handler fires
    if (socket.connected) joinSession()

    intervalRef.current = setInterval(() => setTick((t) => t + 1), 1000)

    api.get<DailySession>(`/api/daily/sessions/${sessionId}`).then((s) => {
      setSession(s)
      setIsLoading(false)
    }).catch(() => {})

    return () => {
      socket.off('connect', joinSession)
      socket.off('daily:state')
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [sessionId])

  // Stop ticking when session is done
  useEffect(() => {
    if (session?.status === 'DONE' && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [session?.status])

  const shuffle = useCallback(() => {
    socketRef.current.emit('daily:shuffle', sessionId)
  }, [sessionId])

  const start = useCallback(() => {
    socketRef.current.emit('daily:start', sessionId)
  }, [sessionId])

  const next = useCallback(() => {
    socketRef.current.emit('daily:next', sessionId)
  }, [sessionId])

  const skip = useCallback(() => {
    socketRef.current.emit('daily:skip', sessionId)
  }, [sessionId])

  const end = useCallback(() => {
    socketRef.current.emit('daily:end', sessionId)
  }, [sessionId])

  // Computed timer values (seconds) — capped at endedAt when session is DONE
  const sessionElapsed = (() => {
    if (!session?.startedAt) return 0
    const started = new Date(session.startedAt).getTime()
    const ceiling = session.endedAt ? new Date(session.endedAt).getTime() : Date.now()
    return Math.floor((ceiling - started) / 1000)
  })()

  const speakerElapsed = (() => {
    const speaker = session?.participants.find((p) => p.status === 'SPEAKING')
    if (!speaker?.speakingAt) return 0
    return Math.floor((Date.now() - new Date(speaker.speakingAt).getTime()) / 1000)
  })()

  const _ = tick // keep tick in scope to re-run computation each second

  return { session, isLoading, sessionElapsed, speakerElapsed, shuffle, start, next, skip, end }
}
