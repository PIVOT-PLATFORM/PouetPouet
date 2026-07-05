'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { TodoRole } from '@/hooks/useTodo'

export interface TodoDashboardSummary {
  id: string
  name: string
  description: string | null
  ownerId: string
  listCount: number
  role: TodoRole
  createdAt: string
  updatedAt: string
}

export interface TodoDashboardListSummary {
  id: string
  name: string
  itemCount: number
  doneCount: number
}

export interface TodoDashboardDetail {
  id: string
  name: string
  description: string | null
  ownerId: string
  role: TodoRole
  lists: TodoDashboardListSummary[]
  createdAt: string
  updatedAt: string
}

export interface TodoDashboardStats {
  byList: { id: string; name: string; itemCount: number; doneCount: number; completionPercent: number; overdueCount: number }[]
  totalItems: number
  totalDone: number
  completionPercent: number
  totalOverdue: number
  byPriority: Record<'NONE' | 'LOW' | 'MEDIUM' | 'HIGH', number>
  recentlyCompleted: { id: string; title: string; listName: string; completedAt: string }[]
}

// ── Liste des tableaux de bord (page /todo/dashboards) ───────────────────────
export function useTodoDashboards() {
  const [dashboards, setDashboards] = useState<TodoDashboardSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<TodoDashboardSummary[]>('/api/todo/dashboards')
      .then(setDashboards)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const createDashboard = useCallback(async (input: { name: string; description?: string | null }) => {
    const db = await api.post<TodoDashboardDetail>('/api/todo/dashboards', input)
    setDashboards((prev) => [{ ...db, listCount: 0 }, ...prev])
    return db
  }, [])

  const deleteDashboard = useCallback(async (id: string) => {
    await api.delete(`/api/todo/dashboards/${id}`)
    setDashboards((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return { dashboards, isLoading, createDashboard, deleteDashboard }
}

// ── Détail d'un tableau de bord + stats (page /todo/dashboards/[id]) ─────────
export function useTodoDashboard(id: string) {
  const [dashboard, setDashboard] = useState<TodoDashboardDetail | null>(null)
  const [stats, setStats] = useState<TodoDashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setAccessDenied(false)
    try {
      const [db, st] = await Promise.all([
        api.get<TodoDashboardDetail>(`/api/todo/dashboards/${id}`),
        api.get<TodoDashboardStats>(`/api/todo/dashboards/${id}/stats`),
      ])
      setDashboard(db)
      setStats(st)
    } catch {
      setAccessDenied(true)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  const updateMeta = useCallback(async (patch: Partial<{ name: string; description: string | null }>) => {
    const updated = await api.patch<TodoDashboardDetail>(`/api/todo/dashboards/${id}`, patch)
    setDashboard((prev) => prev ? { ...prev, ...updated } : updated)
  }, [id])

  const attachList = useCallback(async (listId: string) => {
    await api.post(`/api/todo/dashboards/${id}/lists`, { listId })
    await refresh()
  }, [id, refresh])

  const detachList = useCallback(async (listId: string) => {
    await api.delete(`/api/todo/dashboards/${id}/lists/${listId}`)
    await refresh()
  }, [id, refresh])

  return { dashboard, stats, isLoading, accessDenied, updateMeta, attachList, detachList, refresh }
}
