'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type ChallengeStatus = 'DRAFT' | 'OPEN' | 'EVALUATION' | 'CLOSED'

export interface Challenge {
  id: string
  nom: string
  description: string
  theme: string | null
  status: ChallengeStatus
  opensAt: string | null
  closesAt: string | null
  ownerId: string
  entryCount: number
  createdAt: string
  updatedAt: string
}

export interface ChallengeFicheSummary {
  id: string
  title: string
  pitch: string
  status: string
  authorId: string
  author: { id: string; name: string }
}

export interface ChallengeEntry {
  fiche: ChallengeFicheSummary
  isWinner: boolean
  submittedById: string
}

export interface ChallengeDetail extends Challenge {
  canManage: boolean
  entries: ChallengeEntry[]
}

export interface ChallengeInput {
  nom: string
  description: string
  theme?: string
  opensAt?: string
  closesAt?: string
}

// ── Liste des challenges (page /innovation/challenges) ──────────────────────────
export function useChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<Challenge[]>('/api/innovation/challenges')
      setChallenges(data)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createChallenge = useCallback(async (input: ChallengeInput) => {
    const challenge = await api.post<Challenge>('/api/innovation/challenges', input)
    setChallenges((prev) => [challenge, ...prev])
    return challenge
  }, [])

  return { challenges, isLoading, load, createChallenge }
}

// ── Détail d'un challenge (page /innovation/challenges/[id]) ────────────────────
export function useChallenge(id: string) {
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<ChallengeDetail>(`/api/innovation/challenges/${id}`)
      setChallenge(data)
      setNotFound(false)
    } catch {
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const updateChallenge = useCallback(async (patch: Partial<ChallengeInput & { status: ChallengeStatus }>) => {
    const updated = await api.patch<Challenge>(`/api/innovation/challenges/${id}`, patch)
    setChallenge((prev) => prev ? { ...prev, ...updated } : prev)
    return updated
  }, [id])

  const removeEntry = useCallback(async (ficheId: string) => {
    await api.delete(`/api/innovation/challenges/${id}/entries/${ficheId}`)
    setChallenge((prev) => prev ? { ...prev, entries: prev.entries.filter((e) => e.fiche.id !== ficheId) } : prev)
  }, [id])

  const setWinners = useCallback(async (ficheIds: string[]) => {
    const entries = await api.post<ChallengeEntry[]>(`/api/innovation/challenges/${id}/winners`, { ficheIds })
    setChallenge((prev) => prev ? { ...prev, entries } : prev)
  }, [id])

  return { challenge, isLoading, notFound, updateChallenge, removeEntry, setWinners, reload: load }
}

// ── Challenges auxquels une fiche est inscrite (affichage sur sa page) ──────────
export interface FicheChallengeEntry {
  challenge: { id: string; nom: string; status: ChallengeStatus }
  isWinner: boolean
}

export function useFicheChallengeEntries(ficheId: string) {
  const [entries, setEntries] = useState<FicheChallengeEntry[]>([])

  const load = useCallback(async () => {
    const data = await api.get<FicheChallengeEntry[]>(`/api/innovation/fiches/${ficheId}/challenges`)
    setEntries(data)
  }, [ficheId])

  useEffect(() => { load() }, [load])

  return { entries, reload: load }
}

// ── Inscrire une fiche à un challenge (depuis la page fiche) ────────────────────
export async function submitFicheToChallenge(challengeId: string, ficheId: string) {
  await api.post(`/api/innovation/challenges/${challengeId}/entries`, { ficheId })
}
