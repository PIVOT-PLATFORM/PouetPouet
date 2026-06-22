'use client'

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'

export interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  avatar: string | null
  score: number
  metadata: Record<string, unknown> | null
  createdAt: string
  isMe: boolean
}

interface LeaderboardResponse {
  scores: LeaderboardEntry[]
  myBest: number | null
}

export function useGameLeaderboard(game: 'postit-rush' | 'trivia' | 'bingo') {
  const [scores, setScores] = useState<LeaderboardEntry[]>([])
  const [myBest, setMyBest] = useState<number | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await api.get<LeaderboardResponse>(`/api/games/scores/${game}`)
      setScores(data.scores)
      setMyBest(data.myBest)
    } catch {
      // silently fail — leaderboard is non-critical
    }
  }, [game])

  const submitScore = useCallback(async (score: number, metadata?: Record<string, unknown>) => {
    try {
      await api.post('/api/games/score', { game, score, metadata })
      await fetchLeaderboard()
    } catch {
      // silently fail
    }
  }, [game, fetchLeaderboard])

  return { scores, myBest, fetchLeaderboard, submitScore }
}
