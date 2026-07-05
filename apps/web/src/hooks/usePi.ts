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
