import { useState, useEffect, useRef, useCallback } from 'react'
import { connectSocket } from '@/lib/socket'
import type { ScrumRoom, ScrumTicket, ScrumVote } from './useScrum'

export function useScrumParticipant() {
  const [room, setRoom] = useState<ScrumRoom | null>(null)
  const [participantName, setParticipantName] = useState('')
  const [isJoined, setIsJoined] = useState(false)
  const [participantCount, setParticipantCount] = useState(0)
  // Key: `${ticketId}:${scale}` → voted value
  const [myVotes, setMyVotes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
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

    socket.on('scrum:joined', ({ room: r, participantName: name }: { room: ScrumRoom; participantName: string }) => {
      setRoom(r)
      setParticipantName(name)
      setIsJoined(true)
      setError(null)
    })

    socket.on('scrum:error', (msg: string) => setError(msg))
    socket.on('scrum:participant_count', ({ count }: { count: number }) => setParticipantCount(count))
    socket.on('scrum:room:scale_updated', (scale: string) => {
      setRoom((prev) => prev ? { ...prev, scale } : prev)
    })

    socket.on('scrum:ticket:added', (t: ScrumTicket) => applyTicket({ ...t, votes: [] }))
    socket.on('scrum:ticket:activated', (t: ScrumTicket) => {
      setRoom((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          tickets: prev.tickets.map((tk) =>
            tk.id === t.id ? { ...t, votes: [] } : tk.status === 'VOTING' ? { ...tk, status: 'PENDING' as const } : tk
          ),
        }
      })
    })
    socket.on('scrum:vote:received', ({ ticketId, voteCount }: { ticketId: string; voteCount: number }) => {
      setRoom((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          tickets: prev.tickets.map((t) =>
            t.id === ticketId
              ? { ...t, votes: Array(voteCount).fill({ id: '', ticketId, participantName: '', value: null, scale: '', createdAt: '' }) as ScrumVote[] }
              : t
          ),
        }
      })
    })
    socket.on('scrum:ticket:revealed', (t: ScrumTicket) => applyTicket(t))
    socket.on('scrum:ticket:done', (t: ScrumTicket) => applyTicket(t))
    socket.on('scrum:ticket:reset', ({ ticket: t, scale }: { ticket: ScrumTicket; scale: string }) => {
      applyTicket({ ...t, votes: [] })
      setMyVotes((prev) => {
        const next = { ...prev }
        delete next[`${t.id}:${scale}`]
        return next
      })
    })

    return () => {
      ['scrum:joined', 'scrum:error', 'scrum:participant_count', 'scrum:room:scale_updated',
       'scrum:ticket:added', 'scrum:ticket:activated', 'scrum:vote:received',
       'scrum:ticket:revealed', 'scrum:ticket:done', 'scrum:ticket:reset',
      ].forEach((e) => socket.off(e))
    }
  }, [])

  const join = useCallback((code: string, name: string) => {
    setError(null)
    socketRef.current.emit('scrum:join', { code, participantName: name.trim() })
  }, [])

  const vote = useCallback((ticketId: string, value: string, roomId: string, scale: string) => {
    setMyVotes((prev) => ({ ...prev, [`${ticketId}:${scale}`]: value }))
    socketRef.current.emit('scrum:vote', { ticketId, value, participantName, roomId, scale })
  }, [participantName])

  const activeTicket = room?.tickets.find((t) => t.status === 'VOTING' || t.status === 'REVEALED') ?? null

  return { room, participantName, isJoined, participantCount, myVotes, error, activeTicket, join, vote }
}
