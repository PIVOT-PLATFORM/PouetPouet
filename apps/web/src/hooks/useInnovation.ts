'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type InnovationStatus = 'IDEE' | 'EXPLORATION' | 'ADOPTEE' | 'ABANDONNEE'

export interface InnovationContributorUser {
  id: string
  name: string
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
  author: InnovationContributorUser
  contributors: InnovationContributorUser[]
  votes: number
  hasVoted: boolean
  createdAt: string
  updatedAt: string
}

export interface FicheInput {
  title: string
  pitch: string
  probleme?: string
  solution?: string
  benefices?: string
}

export interface FicheFilters {
  status?: InnovationStatus
  mine?: boolean
  q?: string
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
      const qs = params.toString()
      const data = await api.get<InnovationFiche[]>(`/api/innovation/fiches${qs ? `?${qs}` : ''}`)
      setFiches(data)
    } finally {
      setIsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.mine, filters.q])

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

  return { fiches, isLoading, load, createFiche, toggleVote }
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

  const updateFiche = useCallback(async (patch: Partial<FicheInput & { status: InnovationStatus; abandonReason: string | null }>) => {
    const updated = await api.patch<InnovationFiche>(`/api/innovation/fiches/${id}`, patch)
    setFiche(updated)
    return updated
  }, [id])

  const toggleVote = useCallback(async () => {
    const result = await api.post<{ hasVoted: boolean; votes: number }>(`/api/innovation/fiches/${id}/vote`, {})
    setFiche((prev) => prev ? { ...prev, votes: result.votes, hasVoted: result.hasVoted } : prev)
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

  return { fiche, isLoading, notFound, updateFiche, toggleVote, addContributor, removeContributor }
}
