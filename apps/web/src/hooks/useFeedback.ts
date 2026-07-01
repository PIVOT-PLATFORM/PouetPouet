'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

export type FeedbackColumn = 'ANALYSE' | 'BACKLOG' | 'IMPLEMENTING' | 'PARKING' | 'DONE'
export type FeedbackType = 'BUG' | 'FEATURE'

export interface FeedbackTicket {
  id: string
  title: string
  body: string
  type: FeedbackType
  column: FeedbackColumn
  authorName: string
  authorId: string | null
  votes: number
  hasVoted: boolean
  createdAt: string
  updatedAt: string
}

export function useFeedback() {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.get<FeedbackTicket[]>('/api/feedback')
      setTickets(data)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const createTicket = useCallback(async (title: string, body: string, type: FeedbackType, authorName: string) => {
    const ticket = await api.post<FeedbackTicket>('/api/feedback', { title, body, type, authorName })
    setTickets((prev) => [ticket, ...prev])
    return ticket
  }, [])

  const moveTicket = useCallback(async (id: string, column: FeedbackColumn) => {
    const updated = await api.patch<FeedbackTicket>(`/api/feedback/${id}/column`, { column })
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, column: updated.column } : t)))
  }, [])

  const toggleVote = useCallback(async (id: string) => {
    const result = await api.post<{ hasVoted: boolean; votes: number }>(`/api/feedback/${id}/vote`, {})
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, votes: result.votes, hasVoted: result.hasVoted } : t))
  }, [])

  return { tickets, isLoading, load, createTicket, moveTicket, toggleVote }
}
