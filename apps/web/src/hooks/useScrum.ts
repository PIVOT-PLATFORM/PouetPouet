import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'

export interface ScrumVote {
  id: string
  ticketId: string
  participantName: string
  value: string
  scale: string
  createdAt: string
}

export interface ScrumTicket {
  id: string
  roomId: string
  title: string
  estimate: string | null
  estimateTime: string | null
  order: number
  status: 'PENDING' | 'VOTING' | 'REVEALED' | 'DONE'
  votes: ScrumVote[]
  createdAt: string
}

export interface ScrumRoom {
  id: string
  name: string
  code: string
  ownerId: string
  scale: string
  queue: string[] // file ordonnée de ticketIds restant à estimer (tête = courant)
  tickets: ScrumTicket[]
  createdAt: string
  updatedAt: string
}

export const ESTIMATION_SCALES: Record<string, { label: string; values: string[]; suffix: string }> = {
  FIBONACCI: { label: 'Story Points', values: ['1', '2', '3', '5', '8', '13', '21', '?', '☕'], suffix: 'pts' },
  TIME:      { label: 'Temps',        values: ['0.5h', '1h', '2h', '4h', '6h', '8h', '1j', '2j', '?', '☕'], suffix: '' },
}

export function useScrum(roomId: string) {
  const [room, setRoom] = useState<ScrumRoom | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [participantNames, setParticipantNames] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const socketRef = useRef(connectSocket())

  function applyTicket(ticket: ScrumTicket) {
    setRoom((prev) => {
      if (!prev) return prev
      const exists = prev.tickets.find((t) => t.id === ticket.id)
      return {
        ...prev,
        tickets: exists
          ? prev.tickets.map((t) => (t.id === ticket.id ? ticket : t))
          : [...prev.tickets, ticket].sort((a, b) => a.order - b.order),
      }
    })
  }

  useEffect(() => {
    const socket = socketRef.current
    socket.emit('scrum:host_join', roomId)

    const handleReconnect = () => socket.emit('scrum:host_join', roomId)
    socket.io.on('reconnect', handleReconnect)

    socket.on('scrum:state', ({ room: r, participantCount: c, participantNames: names }: { room: ScrumRoom; participantCount: number; participantNames: string[] }) => {
      setRoom(r)
      setParticipantCount(c)
      setParticipantNames(names ?? [])
      setIsLoading(false)
    })

    socket.on('scrum:participant_count', ({ count, names }: { count: number; names: string[] }) => {
      setParticipantCount(count)
      setParticipantNames(names ?? [])
    })
    socket.on('scrum:ticket:added', (t: ScrumTicket) => applyTicket(t))
    socket.on('scrum:ticket:activated', (t: ScrumTicket) => {
      setRoom((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          tickets: prev.tickets.map((tk) =>
            tk.id === t.id ? t : tk.status === 'VOTING' ? { ...tk, status: 'PENDING' } : tk
          ),
        }
      })
    })
    socket.on('scrum:vote:received', ({ ticketId, voterNames }: { ticketId: string; voteCount: number; voterNames: string[] }) => {
      setRoom((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          tickets: prev.tickets.map((t) =>
            t.id === ticketId
              ? { ...t, votes: (voterNames ?? []).map((name) => ({ id: '', ticketId, participantName: name, value: '', scale: '', createdAt: '' })) }
              : t
          ),
        }
      })
    })
    socket.on('scrum:ticket:revealed', (t: ScrumTicket) => applyTicket(t))
    socket.on('scrum:ticket:done', (t: ScrumTicket) => applyTicket(t))
    socket.on('scrum:ticket:reset', ({ ticket: t }: { ticket: ScrumTicket; scale: string }) => applyTicket(t))

    socket.on('scrum:ticket:deleted', (ticketId: string) => {
      setRoom((prev) => {
        if (!prev) return prev
        return { ...prev, tickets: prev.tickets.filter((t) => t.id !== ticketId) }
      })
    })

    socket.on('scrum:room:scale_updated', (scale: string) => {
      setRoom((prev) => prev ? { ...prev, scale } : prev)
    })

    socket.on('scrum:queue:updated', ({ queue }: { queue: string[] }) => {
      setRoom((prev) => prev ? { ...prev, queue } : prev)
    })

    api.get<ScrumRoom>(`/api/scrum/${roomId}`).then((r) => {
      setRoom(r)
      setIsLoading(false)
    }).catch(() => {})

    return () => {
      socket.io.off('reconnect', handleReconnect)
      ;['scrum:state', 'scrum:participant_count', 'scrum:ticket:added',
        'scrum:ticket:activated', 'scrum:vote:received', 'scrum:ticket:revealed',
        'scrum:ticket:done', 'scrum:ticket:reset', 'scrum:ticket:deleted',
        'scrum:room:scale_updated', 'scrum:queue:updated',
      ].forEach((e) => socket.off(e))
    }
  }, [roomId])

  const addTicket = useCallback((title: string) => {
    socketRef.current.emit('scrum:ticket:add', { roomId, title })
  }, [roomId])

  const bulkAddTickets = useCallback((titles: string[]) => {
    socketRef.current.emit('scrum:ticket:add_bulk', { roomId, titles })
  }, [roomId])

  const activateTicket = useCallback((ticketId: string, scale: string) => {
    socketRef.current.emit('scrum:ticket:activate', { ticketId, roomId, scale })
  }, [roomId])

  const reveal = useCallback((ticketId: string, scale: string) => {
    socketRef.current.emit('scrum:reveal', { ticketId, roomId, scale })
  }, [roomId])

  const setEstimate = useCallback((ticketId: string, estimate: string, scale: string) => {
    socketRef.current.emit('scrum:ticket:estimate', { ticketId, estimate, roomId, scale })
  }, [roomId])

  const bulkEstimate = useCallback((ticketIds: string[], estimate: string, scale: string) => {
    socketRef.current.emit('scrum:ticket:bulk_estimate', { ticketIds, estimate, roomId, scale })
  }, [roomId])

  const resetTicket = useCallback((ticketId: string, scale: string) => {
    socketRef.current.emit('scrum:ticket:reset', { ticketId, roomId, scale })
  }, [roomId])

  const vote = useCallback((ticketId: string, value: string, participantName: string, scale: string) => {
    socketRef.current.emit('scrum:vote', { ticketId, value, participantName, roomId, scale })
  }, [roomId])

  const deleteTicket = useCallback((ticketId: string) => {
    socketRef.current.emit('scrum:ticket:delete', { ticketId, roomId })
  }, [roomId])

  const updateScale = useCallback((scale: string) => {
    setRoom((prev) => prev ? { ...prev, scale } : prev)
    socketRef.current.emit('scrum:room:update_scale', { roomId, scale })
  }, [roomId])

  // File d'estimation : démarrer une file ordonnée (ouvre le vote sur le 1er) ; arrêter.
  const setQueue = useCallback((ticketIds: string[], scale: string) => {
    socketRef.current.emit('scrum:queue:set', { roomId, ticketIds, scale })
  }, [roomId])

  const clearQueue = useCallback(() => {
    socketRef.current.emit('scrum:queue:clear', { roomId })
  }, [roomId])

  const deleteRoom = useCallback(async () => {
    await api.delete(`/api/scrum/${roomId}`)
  }, [roomId])

  return {
    room, participantCount, participantNames, isLoading,
    addTicket, bulkAddTickets, activateTicket, reveal, vote,
    setEstimate, bulkEstimate, resetTicket, deleteTicket,
    updateScale, deleteRoom, setQueue, clearQueue,
  }
}
