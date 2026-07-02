import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { RoadmapDetail, RoadmapScale, Role } from '@/hooks/useRoadmap'

export interface PortfolioSummary {
  id: string
  name: string
  description: string | null
  ownerId: string
  roadmapCount: number
  role: Role
  createdAt: string
  updatedAt: string
}

export interface PortfolioRoadmapSummary {
  id: string
  name: string
  startDate: string
  endDate: string
  scale: RoadmapScale
  itemCount: number
}

export interface PortfolioDetail {
  id: string
  name: string
  description: string | null
  ownerId: string
  roadmaps: PortfolioRoadmapSummary[]
  role: Role
  createdAt: string
  updatedAt: string
}

// ── Liste des portfolios (page /portfolio) ──────────────────────────────────────
export function usePortfolios() {
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api.get<PortfolioSummary[]>('/api/portfolio')
      .then(setPortfolios)
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  const createPortfolio = useCallback(async (input: { name: string; description?: string }) => {
    const pf = await api.post<PortfolioDetail>('/api/portfolio', input)
    setPortfolios((prev) => [{ ...pf, roadmapCount: 0 }, ...prev])
    return pf
  }, [])

  const deletePortfolio = useCallback(async (id: string) => {
    await api.delete(`/api/portfolio/${id}`)
    setPortfolios((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { portfolios, isLoading, createPortfolio, deletePortfolio }
}

// ── Détail d'un portfolio + vue consolidée (page /portfolio/[id]) ──────────────
export function usePortfolio(id: string) {
  const [portfolio, setPortfolio] = useState<PortfolioDetail | null>(null)
  const [roadmapDetails, setRoadmapDetails] = useState<RoadmapDetail[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setAccessDenied(false)
    try {
      const pf = await api.get<PortfolioDetail>(`/api/portfolio/${id}`)
      setPortfolio(pf)
      // Détail complet (avec items) de chaque roadmap rattachée — l'accès
      // transitif via le portfolio est vérifié côté API à chaque appel.
      const details = await Promise.all(pf.roadmaps.map((r) => api.get<RoadmapDetail>(`/api/roadmap/${r.id}`)))
      setRoadmapDetails(details)
    } catch {
      setAccessDenied(true)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { refresh() }, [refresh])

  const updateMeta = useCallback(async (patch: Partial<{ name: string; description: string | null }>) => {
    const updated = await api.patch<PortfolioDetail>(`/api/portfolio/${id}`, patch)
    setPortfolio((prev) => prev ? { ...prev, ...updated } : updated)
  }, [id])

  const attachRoadmap = useCallback(async (roadmapId: string) => {
    await api.post(`/api/portfolio/${id}/roadmaps`, { roadmapId })
    await refresh()
  }, [id, refresh])

  const detachRoadmap = useCallback(async (roadmapId: string) => {
    await api.delete(`/api/portfolio/${id}/roadmaps/${roadmapId}`)
    await refresh()
  }, [id, refresh])

  return { portfolio, roadmapDetails, isLoading, accessDenied, updateMeta, attachRoadmap, detachRoadmap, refresh }
}
