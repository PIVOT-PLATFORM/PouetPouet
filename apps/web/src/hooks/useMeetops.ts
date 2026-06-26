import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { MeetEvent, Meeting, MeetingParticipant, MeetEventType, MeetTemplate, MeetTemplateLine, MeetCalendarEvent, MeetHistory, MeetSearchResult } from '@/lib/meetops'

export type { MeetEvent, Meeting, MeetingParticipant, MeetEventType, MeetTemplate, MeetTemplateLine, MeetCalendarEvent, MeetHistory, MeetSearchResult }

export type BulkAction = 'setLabel' | 'setDuration' | 'shiftDays' | 'delete'

// ── Liste des événements ────────────────────────────────────────────────────────

export interface CreateEventInput {
  name: string
  type?: MeetEventType
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  color?: string
  tags?: string[]
}

export function useMeetEvents() {
  const [events, setEvents] = useState<MeetEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<MeetEvent[]>('/api/meetops/events')
      .then((e) => { setEvents(e); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [])

  const createEvent = useCallback(async (input: CreateEventInput) => {
    const event = await api.post<MeetEvent>('/api/meetops/events', input)
    setEvents((prev) => [event, ...prev])
    return event
  }, [])

  const deleteEvent = useCallback(async (id: string) => {
    await api.delete(`/api/meetops/events/${id}`)
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return { events, isLoading, createEvent, deleteEvent }
}

// ── Événement (écran détail) ────────────────────────────────────────────────────

export function useMeetEvent(eventId: string) {
  const [event, setEvent] = useState<MeetEvent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const ev = await api.get<MeetEvent>(`/api/meetops/events/${eventId}`)
      setEvent(ev)
      setIsLoading(false)
    } catch {
      setError('Événement introuvable')
      setIsLoading(false)
    }
  }, [eventId])

  useEffect(() => { void reload() }, [reload])

  const updateEvent = useCallback(async (patch: Partial<CreateEventInput> & { status?: MeetEvent['status'] }) => {
    const updated = await api.patch<MeetEvent>(`/api/meetops/events/${eventId}`, patch)
    setEvent(updated)
    return updated
  }, [eventId])

  const addMeeting = useCallback(async (
    input: { title?: string; label?: string | null; startAt: string; durationMin?: number; location?: string | null; agenda?: string | null },
  ) => {
    await api.post<Meeting>(`/api/meetops/events/${eventId}/meetings`, input)
    await reload()
  }, [eventId, reload])

  const updateMeeting = useCallback(async (
    meetingId: string,
    patch: Partial<{ title: string; label: string | null; startAt: string; durationMin: number; location: string | null; agenda: string | null; status: Meeting['status'] }>,
  ) => {
    await api.patch<Meeting>(`/api/meetops/meetings/${meetingId}`, patch)
    await reload()
  }, [reload])

  const deleteMeeting = useCallback(async (meetingId: string) => {
    await api.delete(`/api/meetops/meetings/${meetingId}`)
    await reload()
  }, [reload])

  const clearMeetings = useCallback(async () => {
    await api.delete(`/api/meetops/events/${eventId}/meetings`)
    await reload()
  }, [eventId, reload])

  const reorderMeetings = useCallback(async (ids: string[]) => {
    await api.patch(`/api/meetops/events/${eventId}/meetings/reorder`, { ids })
    await reload()
  }, [eventId, reload])

  const bulkUpdate = useCallback(async (action: BulkAction, ids: string[], value?: string | number) => {
    const res = await api.patch<{ affected: number }>(`/api/meetops/events/${eventId}/meetings/bulk`, { ids, action, value })
    await reload()
    return res
  }, [eventId, reload])

  const saveAsTemplate = useCallback(async (input: { name: string; description?: string | null }) => {
    return api.post<MeetTemplate>(`/api/meetops/events/${eventId}/save-as-template`, input)
  }, [eventId])

  const addParticipant = useCallback(async (meetingId: string, input: { email: string; name?: string | null; role?: string | null }) => {
    await api.post<MeetingParticipant>(`/api/meetops/meetings/${meetingId}/participants`, input)
    await reload()
  }, [reload])

  const removeParticipant = useCallback(async (participantId: string) => {
    await api.delete(`/api/meetops/participants/${participantId}`)
    await reload()
  }, [reload])

  const applyList = useCallback(async (meetingId: string, listId: string) => {
    const res = await api.post<{ added: number; skipped: number }>(`/api/meetops/meetings/${meetingId}/apply-list/${listId}`, {})
    await reload()
    return res
  }, [reload])

  const sendMeeting = useCallback(async (meetingId: string) => {
    await api.post<Meeting>(`/api/meetops/meetings/${meetingId}/send`, {})
    await reload()
  }, [reload])

  const sendEvent = useCallback(async () => {
    const res = await api.post<{ total: number; sent: number; failed: number }>(`/api/meetops/events/${eventId}/send`, {})
    await reload()
    return res
  }, [eventId, reload])

  return {
    event, isLoading, error, reload,
    updateEvent,
    addMeeting, updateMeeting, deleteMeeting, clearMeetings, reorderMeetings, bulkUpdate, saveAsTemplate,
    addParticipant, removeParticipant, applyList,
    sendMeeting, sendEvent,
  }
}

// ── Historique d'un événement ─────────────────────────────────────────────────────

export function useMeetHistory(eventId: string, refreshKey?: unknown) {
  const [history, setHistory] = useState<MeetHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  useEffect(() => {
    setIsLoading(true)
    api.get<MeetHistory[]>(`/api/meetops/events/${eventId}/history`)
      .then((h) => { setHistory(h); setIsLoading(false) })
      .catch(() => setIsLoading(false))
  }, [eventId, refreshKey])
  return { history, isLoading }
}

// ── Calendrier multi-événements ───────────────────────────────────────────────────

export function useMeetCalendar() {
  const [events, setEvents] = useState<MeetCalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    const e = await api.get<MeetCalendarEvent[]>('/api/meetops/calendar')
    setEvents(e)
  }, [])

  useEffect(() => {
    reload().finally(() => setIsLoading(false))
  }, [reload])

  const updateMeeting = useCallback(async (
    meetingId: string,
    patch: { startAt?: string; durationMin?: number },
  ) => {
    await api.patch(`/api/meetops/meetings/${meetingId}`, patch)
    await reload()
  }, [reload])

  const createEvent = useCallback(async (input: { name: string }): Promise<string> => {
    const ev = await api.post<{ id: string }>('/api/meetops/events', input)
    return ev.id
  }, [])

  const createMeeting = useCallback(async (
    eventId: string,
    input: { title: string; startAt: string; durationMin?: number },
  ) => {
    await api.post(`/api/meetops/events/${eventId}/meetings`, input)
    await reload()
  }, [reload])

  const deleteMeeting = useCallback(async (meetingId: string) => {
    await api.delete(`/api/meetops/meetings/${meetingId}`)
    await reload()
  }, [reload])

  return { events, isLoading, reload, createEvent, updateMeeting, createMeeting, deleteMeeting }
}

// ── Templates ──────────────────────────────────────────────────────────────────────

export function useMeetTemplates() {
  const [templates, setTemplates] = useState<MeetTemplate[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const reload = useCallback(async () => {
    const t = await api.get<MeetTemplate[]>('/api/meetops/templates')
    setTemplates(t); setIsLoading(false)
  }, [])
  useEffect(() => { reload().catch(() => setIsLoading(false)) }, [reload])

  const createTemplate = useCallback(async (input: {
    name: string; description?: string | null; type?: MeetEventType; color?: string; lines: MeetTemplateLine[]; isShared?: boolean
  }) => {
    await api.post<MeetTemplate>('/api/meetops/templates', input)
    await reload()
  }, [reload])

  const deleteTemplate = useCallback(async (id: string) => {
    await api.delete(`/api/meetops/templates/${id}`)
    await reload()
  }, [reload])

  const instantiate = useCallback(async (id: string, input: { name: string; startDate: string }) => {
    return api.post<MeetEvent>(`/api/meetops/templates/${id}/instantiate`, input)
  }, [])

  return { templates, isLoading, reload, createTemplate, deleteTemplate, instantiate }
}

// ── Recherche transverse d'événements ─────────────────────────────────────────────

export function useMeetSearch(query: string) {
  const [results, setResults] = useState<MeetSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); setIsSearching(false); return }
    setIsSearching(true)
    const t = setTimeout(() => {
      api.get<MeetSearchResult[]>(`/api/meetops/search?q=${encodeURIComponent(q)}`)
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setIsSearching(false))
    }, 250)
    return () => clearTimeout(t)
  }, [query])
  return { results, isSearching }
}
