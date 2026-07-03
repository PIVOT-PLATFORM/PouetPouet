'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export interface Criterion {
  id: string
  challengeId: string
  label: string
  poids: number
  ordre: number
}

export interface Juror {
  id: string
  user: { id: string; name: string; email: string }
}

export interface Score {
  id: string
  criterionId: string
  note: number
  commentaire: string | null
}

export interface RankedEntry {
  entryId: string
  ficheId: string
  weightedAverage: number | null
  criteriaAverages: { criterionId: string; average: number | null }[]
  fiche: { id: string; title: string; authorId: string; author: { id: string; name: string } }
}

// ── Critères (panneau admin) ────────────────────────────────────────────────────
export function useCriteria(challengeId: string) {
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<Criterion[]>(`/api/innovation/challenges/${challengeId}/criteria`)
      setCriteria(data)
    } finally {
      setIsLoading(false)
    }
  }, [challengeId])

  useEffect(() => { load() }, [load])

  const addCriterion = useCallback(async (label: string, poids: number) => {
    await api.post(`/api/innovation/challenges/${challengeId}/criteria`, { label, poids })
    await load()
  }, [challengeId, load])

  const removeCriterion = useCallback(async (criterionId: string) => {
    await api.delete(`/api/innovation/challenges/${challengeId}/criteria/${criterionId}`)
    await load()
  }, [challengeId, load])

  return { criteria, isLoading, addCriterion, removeCriterion, reload: load }
}

// ── Jurés (panneau admin) ────────────────────────────────────────────────────────
export function useJurors(challengeId: string, enabled: boolean) {
  const [jurors, setJurors] = useState<Juror[]>([])

  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const data = await api.get<Juror[]>(`/api/innovation/challenges/${challengeId}/jurors`)
      setJurors(data)
    } catch {
      // 403 si non-admin — silencieux, le composant appelant ne rend pas cette liste
    }
  }, [challengeId, enabled])

  useEffect(() => { load() }, [load])

  const addJuror = useCallback(async (email: string) => {
    await api.post(`/api/innovation/challenges/${challengeId}/jurors`, { email })
    await load()
  }, [challengeId, load])

  const removeJuror = useCallback(async (userId: string) => {
    await api.delete(`/api/innovation/challenges/${challengeId}/jurors/${userId}`)
    await load()
  }, [challengeId, load])

  return { jurors, addJuror, removeJuror, reload: load }
}

// ── Notation d'une fiche par le juré courant ─────────────────────────────────────
export function useMyScores(challengeId: string, ficheId: string, enabled: boolean) {
  const [scores, setScores] = useState<Score[]>([])

  const load = useCallback(async () => {
    if (!enabled) return
    const data = await api.get<Score[]>(`/api/innovation/challenges/${challengeId}/entries/${ficheId}/scores`)
    setScores(data)
  }, [challengeId, ficheId, enabled])

  useEffect(() => { load() }, [load])

  const submit = useCallback(async (input: { criterionId: string; note: number; commentaire?: string }[]) => {
    const data = await api.post<Score[]>(`/api/innovation/challenges/${challengeId}/entries/${ficheId}/scores`, { scores: input })
    setScores(data)
    return data
  }, [challengeId, ficheId])

  return { scores, submit, reload: load }
}

// ── Classement ───────────────────────────────────────────────────────────────────
export function useRanking(challengeId: string, enabled: boolean) {
  const [ranking, setRanking] = useState<RankedEntry[] | null>(null)

  const load = useCallback(async () => {
    if (!enabled) return
    try {
      const data = await api.get<RankedEntry[]>(`/api/innovation/challenges/${challengeId}/ranking`)
      setRanking(data)
    } catch {
      setRanking(null)
    }
  }, [challengeId, enabled])

  useEffect(() => { load() }, [load])

  return { ranking, reload: load }
}
