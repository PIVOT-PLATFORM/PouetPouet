'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type PiCycleStatus = 'PREPARATION' | 'ACTIVE' | 'CLOSED'
export type PiRole = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface PiCycleSummary {
  id: string
  name: string
  artName: string | null
  status: PiCycleStatus
  startDate: string
  endDate: string
  iterationCount: number
  teamCount: number
  role: PiRole
  createdAt: string
  updatedAt: string
}

export interface PiIteration {
  id: string
  cycleId: string
  number: number
  label: string
  startDate: string
  endDate: string
}

export interface PiCycleTeam {
  id: string
  cycleId: string
  name: string
  color: string
  order: number
  sourceTeamId: string | null
}

export interface PiCycleDetail {
  id: string
  name: string
  artName: string | null
  status: PiCycleStatus
  startDate: string
  endDate: string
  eventDay1: string | null
  eventDay2: string | null
  eventLocation: string | null
  iterations: PiIteration[]
  teams: PiCycleTeam[]
  logisticsForm: { id: string; title: string; recipientCount: number; respondedCount: number; responseCount: number } | null
  todoDashboard: { id: string; name: string; listCount: number } | null
  ownerId: string
  role: PiRole
  createdAt: string
  updatedAt: string
}

export interface PiCycleInput {
  name: string
  artName?: string | null
  startDate: string
  iterationCount?: number
  iterationWeeks?: number
  eventDay1?: string | null
  eventDay2?: string | null
  eventLocation?: string | null
}

// ── Liste des PI (page /pi) ──────────────────────────────────────────────────
export function usePiCycles() {
  const [cycles, setCycles] = useState<PiCycleSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<PiCycleSummary[]>('/api/pi/cycles')
      .then(setCycles)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const createCycle = useCallback(async (input: PiCycleInput) => {
    const cycle = await api.post<PiCycleSummary>('/api/pi/cycles', input)
    setCycles((prev) => [cycle, ...prev])
    return cycle
  }, [])

  const deleteCycle = useCallback(async (id: string) => {
    await api.delete(`/api/pi/cycles/${id}`)
    setCycles((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return { cycles, isLoading, createCycle, deleteCycle }
}

// ── Détail d'un PI (page /pi/[id]) ──────────────────────────────────────────
export function usePiCycle(id: string) {
  const [cycle, setCycle] = useState<PiCycleDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.get<PiCycleDetail>(`/api/pi/cycles/${id}`)
      setCycle(data)
      setNotFound(false)
    } catch {
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const updateCycle = useCallback(async (patch: Partial<{
    name: string
    artName: string | null
    status: PiCycleStatus
    eventDay1: string | null
    eventDay2: string | null
    eventLocation: string | null
    todoDashboardId: string | null
  }>) => {
    await api.patch(`/api/pi/cycles/${id}`, patch)
    await load()
  }, [id, load])

  const addTeam = useCallback(async (name: string, color?: string) => {
    await api.post(`/api/pi/cycles/${id}/teams`, { name, ...(color ? { color } : {}) })
    await load()
  }, [id, load])

  const importTeams = useCallback(async (teamIds: string[]) => {
    const result = await api.post<{ imported: number }>(`/api/pi/cycles/${id}/teams/import`, { teamIds })
    await load()
    return result
  }, [id, load])

  const updateTeam = useCallback(async (teamId: string, patch: { name?: string; color?: string; order?: number }) => {
    await api.patch(`/api/pi/cycles/${id}/teams/${teamId}`, patch)
    await load()
  }, [id, load])

  const removeTeam = useCallback(async (teamId: string) => {
    await api.delete(`/api/pi/cycles/${id}/teams/${teamId}`)
    await load()
  }, [id, load])

  const updateIteration = useCallback(async (iterationId: string, patch: { label?: string; startDate?: string; endDate?: string }) => {
    await api.patch(`/api/pi/cycles/${id}/iterations/${iterationId}`, patch)
    await load()
  }, [id, load])

  const createLogisticsForm = useCallback(async () => {
    const result = await api.post<{ formId: string; title: string }>(`/api/pi/cycles/${id}/logistics-form`, {})
    await load()
    return result
  }, [id, load])

  const createTodoDashboard = useCallback(async () => {
    const result = await api.post<{ dashboardId: string; name: string }>(`/api/pi/cycles/${id}/todo-dashboard`, {})
    await load()
    return result
  }, [id, load])

  return { cycle, isLoading, notFound, load, updateCycle, addTeam, importTeams, updateTeam, removeTeam, updateIteration, createLogisticsForm, createTodoDashboard }
}

// ── Program Board (page /pi/[id]/board) ──────────────────────────────────────

export type PiTicketType = 'FEATURE' | 'MILESTONE' | 'RISK' | 'OBJECTIVE' | 'STORY' | 'ENABLER'
export type PiDependencyStatus = 'OK' | 'BLOCKED'

export interface PiTicket {
  id: string
  cycleId: string
  teamId: string | null      // null = ligne Train
  iterationId: string | null // null = colonne « Non planifié »
  type: PiTicketType
  title: string
  description: string | null
  order: number
}

export interface PiDependency {
  id: string
  cycleId: string
  fromTicketId: string // fournisseur
  toTicketId: string   // demandeur
  status: PiDependencyStatus
  note: string | null
}

export interface PiBoard {
  id: string
  name: string
  status: PiCycleStatus
  iterations: PiIteration[]
  teams: PiCycleTeam[]
  tickets: PiTicket[]
  dependencies: PiDependency[]
  role: PiRole
}

export interface PiTicketInput {
  type: PiTicketType
  title: string
  description?: string | null
  teamId?: string | null
  iterationId?: string | null
}

const BOARD_POLL_MS = 20_000

// Pas de socket.io en v1 : polling + refetch au focus, mutations optimistes.
export function usePiBoard(id: string) {
  const [board, setBoard] = useState<PiBoard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await api.get<PiBoard>(`/api/pi/cycles/${id}/board`)
      setBoard(data)
      setNotFound(false)
    } catch {
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    const interval = setInterval(load, BOARD_POLL_MS)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [load])

  const createTicket = useCallback(async (input: PiTicketInput) => {
    const ticket = await api.post<PiTicket>(`/api/pi/cycles/${id}/tickets`, input)
    setBoard((b) => b && { ...b, tickets: [...b.tickets, ticket] })
    return ticket
  }, [id])

  const updateTicket = useCallback(async (ticketId: string, patch: Partial<PiTicketInput> & { order?: number }) => {
    // Optimiste : la cellule/le contenu bouge tout de suite, rollback par reload en cas d'erreur.
    setBoard((b) => b && { ...b, tickets: b.tickets.map((t) => (t.id === ticketId ? { ...t, ...patch } as PiTicket : t)) })
    try {
      await api.patch(`/api/pi/cycles/${id}/tickets/${ticketId}`, patch)
    } catch {
      await load()
    }
  }, [id, load])

  const deleteTicket = useCallback(async (ticketId: string) => {
    setBoard((b) => b && {
      ...b,
      tickets: b.tickets.filter((t) => t.id !== ticketId),
      dependencies: b.dependencies.filter((d) => d.fromTicketId !== ticketId && d.toTicketId !== ticketId),
    })
    try {
      await api.delete(`/api/pi/cycles/${id}/tickets/${ticketId}`)
    } catch {
      await load()
    }
  }, [id, load])

  // Retourne le message d'erreur métier (doublon, boucle…) pour l'afficher, null si OK.
  const createDependency = useCallback(async (fromTicketId: string, toTicketId: string): Promise<string | null> => {
    try {
      const dep = await api.post<PiDependency>(`/api/pi/cycles/${id}/dependencies`, { fromTicketId, toTicketId })
      setBoard((b) => b && { ...b, dependencies: [...b.dependencies, dep] })
      return null
    } catch (e) {
      return e instanceof Error ? e.message : 'Erreur inconnue'
    }
  }, [id])

  const updateDependency = useCallback(async (depId: string, patch: { status?: PiDependencyStatus; note?: string | null }) => {
    setBoard((b) => b && { ...b, dependencies: b.dependencies.map((d) => (d.id === depId ? { ...d, ...patch } as PiDependency : d)) })
    try {
      await api.patch(`/api/pi/cycles/${id}/dependencies/${depId}`, patch)
    } catch {
      await load()
    }
  }, [id, load])

  const deleteDependency = useCallback(async (depId: string) => {
    setBoard((b) => b && { ...b, dependencies: b.dependencies.filter((d) => d.id !== depId) })
    try {
      await api.delete(`/api/pi/cycles/${id}/dependencies/${depId}`)
    } catch {
      await load()
    }
  }, [id, load])

  return { board, isLoading, notFound, load, createTicket, updateTicket, deleteTicket, createDependency, updateDependency, deleteDependency }
}
