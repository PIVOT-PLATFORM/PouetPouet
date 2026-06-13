import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { MeetEvent, MeetSeries, Meeting, MeetingParticipant, MeetEventType } from '@/lib/meetops'

export type { MeetEvent, MeetSeries, Meeting, MeetingParticipant, MeetEventType }

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

  const addSeries = useCallback(async (input: { title: string; defaultDurationMin?: number; defaultAgenda?: string | null }) => {
    await api.post<MeetSeries>(`/api/meetops/events/${eventId}/series`, input)
    await reload()
  }, [eventId, reload])

  const deleteSeries = useCallback(async (seriesId: string) => {
    await api.delete(`/api/meetops/series/${seriesId}`)
    await reload()
  }, [reload])

  const addMeeting = useCallback(async (
    seriesId: string,
    input: { title?: string; startAt: string; durationMin?: number; location?: string | null; agenda?: string | null },
  ) => {
    await api.post<Meeting>(`/api/meetops/series/${seriesId}/meetings`, input)
    await reload()
  }, [reload])

  const updateMeeting = useCallback(async (
    meetingId: string,
    patch: Partial<{ title: string; startAt: string; durationMin: number; location: string | null; agenda: string | null; status: Meeting['status'] }>,
  ) => {
    await api.patch<Meeting>(`/api/meetops/meetings/${meetingId}`, patch)
    await reload()
  }, [reload])

  const deleteMeeting = useCallback(async (meetingId: string) => {
    await api.delete(`/api/meetops/meetings/${meetingId}`)
    await reload()
  }, [reload])

  const generateMeetings = useCallback(async (
    seriesId: string,
    input: {
      freq: 'DAILY' | 'WEEKLY' | 'MONTHLY'
      interval?: number
      startDate: string
      daysOfWeek?: number[]
      until?: string | null
      count?: number | null
      durationMin?: number
      location?: string | null
    },
  ) => {
    const res = await api.post<{ created: number; skipped: number }>(`/api/meetops/series/${seriesId}/generate`, input)
    await reload()
    return res
  }, [reload])

  const addParticipant = useCallback(async (meetingId: string, input: { email: string; name?: string | null; role?: string | null }) => {
    await api.post<MeetingParticipant>(`/api/meetops/meetings/${meetingId}/participants`, input)
    await reload()
  }, [reload])

  const removeParticipant = useCallback(async (participantId: string) => {
    await api.delete(`/api/meetops/participants/${participantId}`)
    await reload()
  }, [reload])

  return {
    event, isLoading, error, reload,
    updateEvent, addSeries, deleteSeries,
    addMeeting, updateMeeting, deleteMeeting, generateMeetings,
    addParticipant, removeParticipant,
  }
}
