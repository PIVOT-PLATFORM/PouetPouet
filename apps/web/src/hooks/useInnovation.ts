'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type InnovationStatus = 'IDEE' | 'EXPLORATION' | 'ADOPTEE' | 'ABANDONNEE'
export type InnovationVisibility = 'PUBLIC' | 'PRIVATE'

export interface InnovationContributorUser {
  id: string
  name: string
}

export interface InnovationCategoryRef {
  id: string
  label: string
}

export interface InnovationFiche {
  id: string
  title: string
  pitch: string
  probleme: string | null
  solution: string | null
  benefices: string | null
  status: InnovationStatus
  abandonReason: string | null
  authorId: string
  orgUnitRef: string | null
  coverImage: string | null
  bannerImage: string | null
  visibility: InnovationVisibility
  author: InnovationContributorUser
  categories: InnovationCategoryRef[]
  contributors: InnovationContributorUser[]
  votes: number
  hasVoted: boolean
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

export interface FicheInput {
  title: string
  pitch: string
  probleme?: string
  solution?: string
  benefices?: string
  orgUnitRef?: string
  categoryIds?: string[]
  visibility?: InnovationVisibility
}

export interface FicheFilters {
  status?: InnovationStatus
  mine?: boolean
  q?: string
  categoryIds?: string[]
  orgUnitRef?: string
  favorite?: boolean
}

// ── Liste des fiches (page /innovation) ─────────────────────────────────────────
export function useInnovationFiches(filters: FicheFilters = {}) {
  const [fiches, setFiches] = useState<InnovationFiche[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.mine) params.set('mine', 'true')
      if (filters.q) params.set('q', filters.q)
      if (filters.categoryIds?.length) params.set('categoryIds', filters.categoryIds.join(','))
      if (filters.orgUnitRef) params.set('orgUnitRef', filters.orgUnitRef)
      if (filters.favorite) params.set('favorite', 'true')
      const qs = params.toString()
      const data = await api.get<InnovationFiche[]>(`/api/innovation/fiches${qs ? `?${qs}` : ''}`)
      setFiches(data)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.mine, filters.q, filters.categoryIds, filters.orgUnitRef, filters.favorite])

  useEffect(() => { load() }, [load])

  const createFiche = useCallback(async (input: FicheInput) => {
    const fiche = await api.post<InnovationFiche>('/api/innovation/fiches', input)
    setFiches((prev) => [fiche, ...prev])
    return fiche
  }, [])

  const toggleVote = useCallback(async (id: string) => {
    const result = await api.post<{ hasVoted: boolean; votes: number }>(`/api/innovation/fiches/${id}/vote`, {})
    setFiches((prev) => prev.map((f) => f.id === id ? { ...f, votes: result.votes, hasVoted: result.hasVoted } : f))
  }, [])

  const toggleFavorite = useCallback(async (id: string) => {
    const result = await api.post<{ isFavorite: boolean }>(`/api/innovation/fiches/${id}/favorite`, {})
    setFiches((prev) => prev.map((f) => f.id === id ? { ...f, isFavorite: result.isFavorite } : f))
  }, [])

  return { fiches, isLoading, load, createFiche, toggleVote, toggleFavorite }
}

// ── Détail d'une fiche (page /innovation/[id]) ──────────────────────────────────
export function useInnovationFiche(id: string) {
  const [fiche, setFiche] = useState<InnovationFiche | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<InnovationFiche>(`/api/innovation/fiches/${id}`)
      setFiche(data)
      setNotFound(false)
    } catch {
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const updateFiche = useCallback(async (patch: Partial<Omit<FicheInput, 'orgUnitRef' | 'categoryIds' | 'probleme' | 'solution' | 'benefices'> & {
    status: InnovationStatus
    abandonReason: string | null
    orgUnitRef: string | null
    categoryIds: string[]
    probleme: string | null
    solution: string | null
    benefices: string | null
    coverImage: string | null
    bannerImage: string | null
  }>) => {
    const updated = await api.patch<InnovationFiche>(`/api/innovation/fiches/${id}`, patch)
    setFiche(updated)
    return updated
  }, [id])

  const toggleVote = useCallback(async () => {
    const result = await api.post<{ hasVoted: boolean; votes: number }>(`/api/innovation/fiches/${id}/vote`, {})
    setFiche((prev) => prev ? { ...prev, votes: result.votes, hasVoted: result.hasVoted } : prev)
  }, [id])

  const toggleFavorite = useCallback(async () => {
    const result = await api.post<{ isFavorite: boolean }>(`/api/innovation/fiches/${id}/favorite`, {})
    setFiche((prev) => prev ? { ...prev, isFavorite: result.isFavorite } : prev)
  }, [id])

  const addContributor = useCallback(async (email: string) => {
    const updated = await api.post<InnovationFiche>(`/api/innovation/fiches/${id}/contributors`, { email })
    setFiche(updated)
    return updated
  }, [id])

  const removeContributor = useCallback(async (userId: string) => {
    await api.delete(`/api/innovation/fiches/${id}/contributors/${userId}`)
    setFiche((prev) => prev ? { ...prev, contributors: prev.contributors.filter((c) => c.id !== userId) } : prev)
  }, [id])

  return { fiche, isLoading, notFound, updateFiche, toggleVote, toggleFavorite, addContributor, removeContributor }
}
