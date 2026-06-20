import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type DrawMode = 'WEIGHTED' | 'RANDOM'

export interface WheelDraw {
  id: string
  ownerId: string
  teamId: string | null
  teamName: string | null
  eventId: string | null
  note: string | null
  count: number
  mode: DrawMode
  results: string[]
  excluded: string[]
  createdAt: string
}

export interface WheelEvent {
  id: string
  name: string
  ownerId: string
  draws: WheelDraw[]
  role?: 'OWNER' | 'EDITOR' | 'VIEWER'
  createdAt: string
  updatedAt: string
}

export function useWheel() {
  const [events, setEvents] = useState<WheelEvent[]>([])
  const [draws, setDraws] = useState<WheelDraw[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<WheelEvent[]>('/api/wheel/events'),
      api.get<WheelDraw[]>('/api/wheel/draws'),
    ]).then(([evts, drs]) => {
      setEvents(evts)
      setDraws(drs)
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [])

  // ── Events ────────────────────────────────────────────────────────────────────

  const createEvent = useCallback(async (name: string) => {
    const event = await api.post<WheelEvent>('/api/wheel/events', { name })
    setEvents((prev) => [event, ...prev])
    return event
  }, [])

  const updateEvent = useCallback(async (id: string, name: string) => {
    const event = await api.patch<WheelEvent>(`/api/wheel/events/${id}`, { name })
    setEvents((prev) => prev.map((e) => (e.id === id ? event : e)))
  }, [])

  const deleteEvent = useCallback(async (id: string) => {
    await api.delete(`/api/wheel/events/${id}`)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    // Remove eventId from draws that belonged to this event
    setDraws((prev) => prev.map((d) => d.eventId === id ? { ...d, eventId: null } : d))
  }, [])

  // ── Draws ─────────────────────────────────────────────────────────────────────

  // Calls the API but does NOT update local state — call commitDraw() after animation
  const createDraw = useCallback(async (
    teamId: string,
    count: number,
    excluded: string[],
    mode: DrawMode,
    eventId?: string,
    note?: string,
  ) => {
    return api.post<WheelDraw>('/api/wheel/draws', { teamId, count, excluded, mode, eventId, note })
  }, [])

  // Adds a draw to local state (call this once the reveal animation is done)
  const commitDraw = useCallback((draw: WheelDraw) => {
    setDraws((prev) => [draw, ...prev])
    if (draw.eventId) {
      setEvents((prev) => prev.map((e) =>
        e.id === draw.eventId ? { ...e, draws: [draw, ...e.draws] } : e
      ))
    }
  }, [])

  const updateDraw = useCallback(async (id: string, patch: { note?: string; eventId?: string | null }) => {
    const draw = await api.patch<WheelDraw>(`/api/wheel/draws/${id}`, patch)
    setDraws((prev) => prev.map((d) => (d.id === id ? draw : d)))
    setEvents((prev) => prev.map((e) => {
      const belongs = draw.eventId === e.id
      const already = e.draws.some((d) => d.id === id)
      if (belongs && already) return { ...e, draws: e.draws.map((d) => d.id === id ? draw : d) }
      if (belongs && !already) return { ...e, draws: [draw, ...e.draws] }
      if (!belongs && already) return { ...e, draws: e.draws.filter((d) => d.id !== id) }
      return e
    }))
    return draw
  }, [])

  const deleteDraw = useCallback(async (id: string) => {
    await api.delete(`/api/wheel/draws/${id}`)
    setDraws((prev) => prev.filter((d) => d.id !== id))
    setEvents((prev) => prev.map((e) => ({ ...e, draws: e.draws.filter((d) => d.id !== id) })))
  }, [])

  // Standalone draws (not in any event)
  const standaloneDraws = draws.filter((d) => !d.eventId)

  return {
    events, draws, standaloneDraws, isLoading,
    createEvent, updateEvent, deleteEvent,
    createDraw, commitDraw, updateDraw, deleteDraw,
  }
}
