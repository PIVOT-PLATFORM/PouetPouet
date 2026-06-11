import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type {
  CapacityTeam,
  CapacityEvent,
  CapacityEventMember,
  CapacityAbsence,
  CapacityEventType,
  CapacityEventStatus,
} from '@/lib/capacity'

export type {
  CapacityTeam,
  CapacityEvent,
  CapacityEventMember,
  CapacityAbsence,
  CapacityEventType,
  CapacityEventStatus,
}

interface MemberInput {
  name: string
  role?: string | null
  fte?: number
  focusFactor?: number | null
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export function useCapacityTeams() {
  const [teams, setTeams] = useState<CapacityTeam[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<CapacityTeam[]>('/api/teams')
      .then((t) => { setTeams(t); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [])

  const createTeam = useCallback(async (name: string, members: MemberInput[], color?: string, description?: string) => {
    const team = await api.post<CapacityTeam>('/api/teams', { name, members, color, description })
    setTeams((prev) => [...prev, team])
    return team
  }, [])

  const updateTeam = useCallback(async (id: string, name: string, members: MemberInput[], color?: string, description?: string) => {
    const team = await api.put<CapacityTeam>(`/api/teams/${id}`, { name, members, color, description })
    setTeams((prev) => prev.map((t) => (t.id === id ? team : t)))
    return team
  }, [])

  const deleteTeam = useCallback(async (id: string) => {
    await api.delete(`/api/teams/${id}`)
    setTeams((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { teams, isLoading, createTeam, updateTeam, deleteTeam }
}

// ── Events list ─────────────────────────────────────────────────────────────

export interface CreateEventInput {
  name: string
  type: CapacityEventType
  teamId?: string | null
  parentId?: string | null
  startDate: string
  endDate: string
  workingDays?: number[]
  hoursPerDay?: number
  focusFactor?: number
  pointsPerPersonDay?: number | null
  seedFromTeam?: boolean
}

export function useCapacityEvents() {
  const [events, setEvents] = useState<CapacityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<CapacityEvent[]>('/api/capacity/events')
      .then((e) => { setEvents(e); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [])

  const createEvent = useCallback(async (input: CreateEventInput) => {
    const event = await api.post<CapacityEvent>('/api/capacity/events', input)
    setEvents((prev) => [event, ...prev])
    return event
  }, [])

  const deleteEvent = useCallback(async (id: string) => {
    await api.delete(`/api/capacity/events/${id}`)
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { events, isLoading, createEvent, deleteEvent }
}

// ── Single event (detail screen) ──────────────────────────────────────────────

export function useCapacityEvent(eventId: string) {
  const [event, setEvent] = useState<CapacityEvent | null>(null)
  const [history, setHistory] = useState<CapacityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const ev = await api.get<CapacityEvent>(`/api/capacity/events/${eventId}`)
      setEvent(ev)
      setIsLoading(false)
      api.get<CapacityEvent[]>(`/api/capacity/events/${eventId}/history`).then(setHistory).catch(() => {})
    } catch {
      setError('Événement introuvable')
      setIsLoading(false)
    }
  }, [eventId])

  useEffect(() => { void reload() }, [reload])

  // ── Event params ──
  const updateEvent = useCallback(async (patch: Partial<CapacityEvent>) => {
    const updated = await api.put<CapacityEvent>(`/api/capacity/events/${eventId}`, patch)
    setEvent(updated)
    // Realization figures may have changed → refresh history-derived stats.
    api.get<CapacityEvent[]>(`/api/capacity/events/${eventId}/history`).then(setHistory).catch(() => {})
    return updated
  }, [eventId])

  // ── Members ──
  const addMember = useCallback(async (input: MemberInput) => {
    const member = await api.post<CapacityEventMember>(`/api/capacity/events/${eventId}/members`, input)
    setEvent((prev) => prev ? { ...prev, members: [...prev.members, member] } : prev)
    return member
  }, [eventId])

  const updateMember = useCallback(async (memberId: string, patch: Partial<MemberInput>) => {
    const member = await api.put<CapacityEventMember>(`/api/capacity/members/${memberId}`, patch)
    setEvent((prev) => prev ? { ...prev, members: prev.members.map((m) => m.id === memberId ? member : m) } : prev)
    return member
  }, [])

  const deleteMember = useCallback(async (memberId: string) => {
    await api.delete(`/api/capacity/members/${memberId}`)
    setEvent((prev) => prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : prev)
  }, [])

  // ── Absences ──
  const addAbsence = useCallback(async (memberId: string, abs: { startDate: string; endDate: string; fraction?: number; reason?: string }) => {
    const absence = await api.post<CapacityAbsence>(`/api/capacity/members/${memberId}/absences`, abs)
    setEvent((prev) => prev ? {
      ...prev,
      members: prev.members.map((m) => m.id === memberId ? { ...m, absences: [...m.absences, absence] } : m),
    } : prev)
    return absence
  }, [])

  const deleteAbsence = useCallback(async (memberId: string, absenceId: string) => {
    await api.delete(`/api/capacity/absences/${absenceId}`)
    setEvent((prev) => prev ? {
      ...prev,
      members: prev.members.map((m) => m.id === memberId ? { ...m, absences: m.absences.filter((a) => a.id !== absenceId) } : m),
    } : prev)
  }, [])

  return {
    event, history, isLoading, error,
    reload, updateEvent,
    addMember, updateMember, deleteMember,
    addAbsence, deleteAbsence,
  }
}
