'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { connectSocket } from '@/lib/socket'

export type KahootStatus = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'ENDED'

export interface KahootParticipant {
  id: string
  name: string
  score: number
}

export interface KahootQuestion {
  index: number
  total: number
  text: string
  options: string[]
  timeLimit: number
  points: number
}

export interface KahootState {
  sessionId: string
  code: string
  status: KahootStatus
  quizTitle: string
  currentQuestion: number
  totalQuestions: number
  participants: KahootParticipant[]
  questionEndAt?: string
  question?: KahootQuestion
}

export interface KahootReveal {
  correct: number
  stats: number[]
  scores: { name: string; score: number; delta: number }[]
}

export interface KahootLeaderboard {
  podium: { name: string; score: number }[]
}

export interface KahootEnded {
  podium: { name: string; score: number; rank: number }[]
}

// Hook for host view
export function useKahootHost(sessionId: string) {
  const [state, setState] = useState<KahootState | null>(null)
  const [reveal, setReveal] = useState<KahootReveal | null>(null)
  const [leaderboard, setLeaderboard] = useState<KahootLeaderboard | null>(null)
  const [ended, setEnded] = useState<KahootEnded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef(connectSocket())
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  useEffect(() => {
    const socket = socketRef.current

    const handleConnect = () => {
      socket.emit('kahoot:host_join', { sessionId: sessionIdRef.current })
    }
    socket.on('connect', handleConnect)
    if (socket.connected) handleConnect()

    socket.on('kahoot:state', (s: KahootState) => {
      setState(s)
      if (s.status !== 'REVEAL') setReveal(null)
      if (s.status !== 'LEADERBOARD') setLeaderboard(null)
    })
    socket.on('kahoot:reveal', (r: KahootReveal) => setReveal(r))
    socket.on('kahoot:leaderboard', (l: KahootLeaderboard) => setLeaderboard(l))
    socket.on('kahoot:ended', (e: KahootEnded) => setEnded(e))
    socket.on('kahoot:error', (msg: string) => setError(msg))

    return () => {
      socket.off('connect', handleConnect)
      ;['kahoot:state', 'kahoot:reveal', 'kahoot:leaderboard', 'kahoot:ended', 'kahoot:error'].forEach(
        (e) => socket.off(e)
      )
    }
  }, [])

  const start = useCallback(() => {
    socketRef.current.emit('kahoot:start', { sessionId })
  }, [sessionId])

  const next = useCallback(() => {
    socketRef.current.emit('kahoot:next', { sessionId })
  }, [sessionId])

  const end = useCallback(() => {
    socketRef.current.emit('kahoot:end', { sessionId })
  }, [sessionId])

  return { state, reveal, leaderboard, ended, error, start, next, end }
}

// Hook for participant view
export function useKahootParticipant() {
  const [state, setState] = useState<KahootState | null>(null)
  const [reveal, setReveal] = useState<KahootReveal | null>(null)
  const [leaderboard, setLeaderboard] = useState<KahootLeaderboard | null>(null)
  const [ended, setEnded] = useState<KahootEnded | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [pointsEarned, setPointsEarned] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef(connectSocket())
  // Store join params for reconnect — anti-race condition pattern
  const joinParamsRef = useRef<{ code: string; name: string } | null>(null)
  const participantIdRef = useRef<string | null>(null)

  useEffect(() => {
    const socket = socketRef.current

    const handleConnect = () => {
      if (joinParamsRef.current) {
        socket.emit('kahoot:participant_join', joinParamsRef.current)
      }
    }
    socket.on('connect', handleConnect)

    socket.on('kahoot:state', (s: KahootState) => {
      setState(s)
      // Reset per-question state when new question starts
      if (s.status === 'QUESTION') {
        setHasAnswered(false)
        setPointsEarned(null)
        setReveal(null)
      }
      if (s.status !== 'LEADERBOARD') setLeaderboard(null)
    })
    socket.on('kahoot:reveal', (r: KahootReveal) => {
      setReveal(r)
      // Find own delta
      if (participantIdRef.current) {
        const me = r.scores.find((s) => {
          // match by participantId is unavailable in reveal — scores is { name, score, delta }
          // we'll find it in the parent component using name
          return false
        })
        if (me) setPointsEarned(me.delta)
      }
    })
    socket.on('kahoot:leaderboard', (l: KahootLeaderboard) => setLeaderboard(l))
    socket.on('kahoot:ended', (e: KahootEnded) => setEnded(e))
    socket.on('kahoot:answer_ack', ({ participantId: pid }: { participantId: string; received: boolean }) => {
      participantIdRef.current = pid
      setParticipantId(pid)
      setHasAnswered(true)
    })
    socket.on('kahoot:error', (msg: string) => setError(msg))

    return () => {
      socket.off('connect', handleConnect)
      ;['kahoot:state', 'kahoot:reveal', 'kahoot:leaderboard', 'kahoot:ended', 'kahoot:answer_ack', 'kahoot:error'].forEach(
        (e) => socket.off(e)
      )
    }
  }, [])

  const join = useCallback((code: string, name: string) => {
    joinParamsRef.current = { code, name: name.trim() }
    setError(null)
    if (socketRef.current.connected) {
      socketRef.current.emit('kahoot:participant_join', { code, name: name.trim() })
    }
  }, [])

  const answer = useCallback(
    (optionIndex: number, responseMs: number) => {
      if (!state?.sessionId || !participantIdRef.current || hasAnswered) return
      socketRef.current.emit('kahoot:answer', {
        sessionId: state.sessionId,
        participantId: participantIdRef.current,
        optionIndex,
        responseMs,
      })
    },
    [state?.sessionId, hasAnswered]
  )

  return {
    state,
    reveal,
    leaderboard,
    ended,
    participantId,
    hasAnswered,
    pointsEarned,
    error,
    join,
    answer,
  }
}
