import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type RoadmapScale = 'week' | 'month' | 'quarter' | 'semester' | 'year'
export type Risk = 'low' | 'med' | 'high'
export type Prio = 'should' | 'must'
export type Category = 'infra' | 'dev' | 'cyber'
export type Role = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface RoadmapItem {
  id: string
  roadmapId: string
  name: string
  startDate: string // yyyy-mm-dd
  endDate: string // yyyy-mm-dd
  biz: string | null
  risk: Risk
  prio: Prio
  categories: Category[]
  deps: string[]
  order: number
  createdAt: string
  updatedAt: string
}

export interface RoadmapSummary {
  id: string
  name: string
  ownerId: string
  startDate: string
  endDate: string
  scale: RoadmapScale
  itemCount: number
  role: Role
  createdAt: string
  updatedAt: string
}

export interface RoadmapDetail {
  id: string
  name: string
  ownerId: string
  startDate: string
  endDate: string
  scale: RoadmapScale
  items: RoadmapItem[]
  role: Role
  createdAt: string
  updatedAt: string
}

export interface ItemInput {
  name: string
  startDate: string
  endDate: string
  biz?: string
  risk?: Risk
  prio?: Prio
  categories?: Category[]
  deps?: string[]
}

// ── Liste des roadmaps (page /roadmap) ──────────────────────────────────────────
export function useRoadmaps() {
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<RoadmapSummary[]>('/api/roadmap')
      .then(setRoadmaps)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const createRoadmap = useCallback(async (input: { name: string; startDate: string; endDate: string; scale?: RoadmapScale }) => {
    const rm = await api.post<RoadmapDetail>('/api/roadmap', input)
    setRoadmaps((prev) => [{ ...rm, itemCount: 0 }, ...prev])
    return rm
  }, [])

  const deleteRoadmap = useCallback(async (id: string) => {
    await api.delete(`/api/roadmap/${id}`)
    setRoadmaps((prev) => prev.filter((r) => r.id !== id))
  }, [])

  return { roadmaps, isLoading, createRoadmap, deleteRoadmap }
}

// ── Détail d'un roadmap (éditeur Gantt /roadmap/[id]) ───────────────────────────
export function useRoadmap(id: string) {
  const [roadmap, setRoadmap] = useState<RoadmapDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  useEffect(() => {
    api.get<RoadmapDetail>(`/api/roadmap/${id}`)
      .then(setRoadmap)
      .catch(() => setAccessDenied(true))
      .finally(() => setIsLoading(false))
  }, [id])

  const updateMeta = useCallback(async (patch: Partial<{ name: string; startDate: string; endDate: string; scale: RoadmapScale }>) => {
    const updated = await api.patch<RoadmapDetail>(`/api/roadmap/${id}`, patch)
    setRoadmap(updated)
    return updated
  }, [id])

  const createItem = useCallback(async (input: ItemInput) => {
    const item = await api.post<RoadmapItem>(`/api/roadmap/${id}/items`, input)
    setRoadmap((prev) => prev ? { ...prev, items: [...prev.items, item] } : prev)
    return item
  }, [id])

  const updateItem = useCallback(async (itemId: string, patch: Partial<ItemInput>) => {
    const item = await api.patch<RoadmapItem>(`/api/roadmap/${id}/items/${itemId}`, patch)
    setRoadmap((prev) => prev ? { ...prev, items: prev.items.map((it) => it.id === itemId ? item : it) } : prev)
    return item
  }, [id])

  const deleteItem = useCallback(async (itemId: string) => {
    await api.delete(`/api/roadmap/${id}/items/${itemId}`)
    setRoadmap((prev) => prev ? {
      ...prev,
      items: prev.items
        .filter((it) => it.id !== itemId)
        .map((it) => it.deps.includes(itemId) ? { ...it, deps: it.deps.filter((d) => d !== itemId) } : it),
    } : prev)
  }, [id])

  const reorderItems = useCallback(async (orderedIds: string[]) => {
    // Optimistic local reorder
    setRoadmap((prev) => {
      if (!prev) return prev
      const byId = new Map(prev.items.map((it) => [it.id, it]))
      const reordered = orderedIds.map((iid, idx) => {
        const it = byId.get(iid)!
        return { ...it, order: idx }
      })
      return { ...prev, items: reordered }
    })
    await api.put(`/api/roadmap/${id}/items/order`, { order: orderedIds })
  }, [id])

  return { roadmap, isLoading, accessDenied, updateMeta, createItem, updateItem, deleteItem, reorderItems }
}
