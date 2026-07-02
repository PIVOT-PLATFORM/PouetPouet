'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'

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
  const socketRef = useRef(connectSocket())

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

  // ── Socket temps réel ──────────────────────────────────────────────────────
  // Pattern CLAUDE.md : émettre le join dans on('connect') pour survivre aux
  // reconnexions et au double-mount React Strict Mode.
  useEffect(() => {
    const socket = socketRef.current

    function joinRoom() { socket.emit('feedback:join') }

    socket.on('connect', joinRoom)
    if (socket.connected) joinRoom()

    socket.on('feedback:ticket:created', (t: FeedbackTicket) => {
      setTickets((prev) => prev.some((p) => p.id === t.id) ? prev : [t, ...prev])
    })
    socket.on('feedback:ticket:updated', (t: FeedbackTicket) => {
      // hasVoted est par-utilisateur : le payload broadcast le met toujours à false,
      // on préserve donc l'état de vote local du client.
      setTickets((prev) => prev.map((p) => p.id === t.id ? { ...p, ...t, hasVoted: p.hasVoted } : p))
    })
    socket.on('feedback:ticket:moved', (t: FeedbackTicket) => {
      setTickets((prev) => prev.map((p) => p.id === t.id ? { ...p, column: t.column } : p))
    })
    socket.on('feedback:ticket:deleted', ({ id }: { id: string }) => {
      setTickets((prev) => prev.filter((p) => p.id !== id))
    })
    socket.on('feedback:ticket:voted', ({ ticketId, votes }: { ticketId: string; votes: number; hasVoted: boolean }) => {
      // On met à jour le compte global ; hasVoted reste local (chaque client a le sien).
      setTickets((prev) => prev.map((p) => p.id === ticketId ? { ...p, votes } : p))
    })

    return () => {
      socket.emit('feedback:leave')
      socket.off('connect', joinRoom)
      socket.off('feedback:ticket:created')
      socket.off('feedback:ticket:updated')
      socket.off('feedback:ticket:moved')
      socket.off('feedback:ticket:deleted')
      socket.off('feedback:ticket:voted')
    }
  }, [])

  // ── Actions ────────────────────────────────────────────────────────────────

  const createTicket = useCallback(async (title: string, body: string, type: FeedbackType, authorName: string) => {
    const ticket = await api.post<FeedbackTicket>('/api/feedback', { title, body, type, authorName })
    // Le broadcast socket ajoutera le ticket pour les autres ; on l'ajoute localement ici.
    setTickets((prev) => prev.some((p) => p.id === ticket.id) ? prev : [ticket, ...prev])
    return ticket
  }, [])

  const updateTicket = useCallback(async (id: string, data: { title?: string; body?: string; type?: FeedbackType }) => {
    const updated = await api.patch<FeedbackTicket>(`/api/feedback/${id}`, data)
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)))
  }, [])

  const moveTicket = useCallback(async (id: string, column: FeedbackColumn) => {
    const updated = await api.patch<FeedbackTicket>(`/api/feedback/${id}/column`, { column })
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, column: updated.column } : t)))
  }, [])

  const deleteTicket = useCallback(async (id: string) => {
    await api.delete(`/api/feedback/${id}`)
    setTickets((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toggleVote = useCallback(async (id: string) => {
    const result = await api.post<{ hasVoted: boolean; votes: number }>(`/api/feedback/${id}/vote`, {})
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, votes: result.votes, hasVoted: result.hasVoted } : t))
  }, [])

  return { tickets, isLoading, load, createTicket, updateTicket, moveTicket, deleteTicket, toggleVote }
}
