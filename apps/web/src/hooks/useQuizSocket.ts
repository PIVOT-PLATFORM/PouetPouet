'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { connectSocket } from '@/lib/socket'

export type QuizStatus = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'ENDED'

export interface QuizParticipant {
  id: string
  name: string
  score: number
}

export interface QuizQuestion {
  index: number
  total: number
  text: string
  options: string[]
  timeLimit: number
  points: number
}

export interface QuizState {
  sessionId: string
  code: string
  status: QuizStatus
  quizTitle: string
  currentQuestion: number
  totalQuestions: number
  participants: QuizParticipant[]
  questionEndAt?: string
  question?: QuizQuestion
}

export interface QuizReveal {
  correct: number
  stats: number[]
  scores: { name: string; score: number; delta: number }[]
}

export interface QuizLeaderboard {
  podium: { name: string; score: number }[]
}

export interface QuizEnded {
  podium: { name: string; score: number; rank: number }[]
}

// Hook for host view
export function useQuizHost(sessionId: string) {
  const [state, setState] = useState<QuizState | null>(null)
  const [reveal, setReveal] = useState<QuizReveal | null>(null)
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboard | null>(null)
  const [ended, setEnded] = useState<QuizEnded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef(connectSocket())
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  useEffect(() => {
    const socket = socketRef.current

    const handleConnect = () => {
      socket.emit('quiz:host_join', { sessionId: sessionIdRef.current })
    }
    socket.on('connect', handleConnect)
    if (socket.connected) handleConnect()

    socket.on('quiz:state', (s: QuizState) => {
      setState(s)
      if (s.status !== 'REVEAL') setReveal(null)
      if (s.status !== 'LEADERBOARD') setLeaderboard(null)
    })
    socket.on('quiz:reveal', (r: QuizReveal) => setReveal(r))
    socket.on('quiz:leaderboard', (l: QuizLeaderboard) => setLeaderboard(l))
    socket.on('quiz:ended', (e: QuizEnded) => setEnded(e))
    socket.on('quiz:error', (msg: string) => setError(msg))

    return () => {
      socket.off('connect', handleConnect)
      ;['quiz:state', 'quiz:reveal', 'quiz:leaderboard', 'quiz:ended', 'quiz:error'].forEach(
        (e) => socket.off(e)
      )
    }
  }, [])

  const start = useCallback(() => {
    socketRef.current.emit('quiz:start', { sessionId })
  }, [sessionId])

  const next = useCallback(() => {
    socketRef.current.emit('quiz:next', { sessionId })
  }, [sessionId])

  const end = useCallback(() => {
    socketRef.current.emit('quiz:end', { sessionId })
  }, [sessionId])

  return { state, reveal, leaderboard, ended, error, start, next, end }
}

// Hook for participant view
export function useQuizParticipant() {
  const [state, setState] = useState<QuizState | null>(null)
  const [reveal, setReveal] = useState<QuizReveal | null>(null)
  const [leaderboard, setLeaderboard] = useState<QuizLeaderboard | null>(null)
  const [ended, setEnded] = useState<QuizEnded | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [pointsEarned, setPointsEarned] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef(connectSocket())
  const joinParamsRef = useRef<{ code: string; name: string } | null>(null)
  const participantIdRef = useRef<string | null>(null)

  useEffect(() => {
    const socket = socketRef.current

    const handleConnect = () => {
      if (joinParamsRef.current) {
        socket.emit('quiz:participant_join', joinParamsRef.current)
      }
    }
    socket.on('connect', handleConnect)

    socket.on('quiz:state', (s: QuizState) => {
      setState(s)
      if (s.status === 'QUESTION') {
        setHasAnswered(false)
        setPointsEarned(null)
        setReveal(null)
      }
      if (s.status !== 'LEADERBOARD') setLeaderboard(null)
    })
    socket.on('quiz:reveal', (r: QuizReveal) => {
      setReveal(r)
      if (participantIdRef.current) {
        const me = r.scores.find(() => false)
        if (me) setPointsEarned(me.delta)
      }
    })
    socket.on('quiz:leaderboard', (l: QuizLeaderboard) => setLeaderboard(l))
    socket.on('quiz:ended', (e: QuizEnded) => setEnded(e))
    socket.on('quiz:joined', ({ participantId: pid }: { participantId: string }) => {
      participantIdRef.current = pid
      setParticipantId(pid)
    })
    socket.on('quiz:answer_ack', ({ participantId: pid }: { participantId: string; received: boolean }) => {
      participantIdRef.current = pid
      setParticipantId(pid)
      setHasAnswered(true)
    })
    socket.on('quiz:error', (msg: string) => setError(msg))

    return () => {
      socket.off('connect', handleConnect)
      ;['quiz:state', 'quiz:reveal', 'quiz:leaderboard', 'quiz:ended', 'quiz:joined', 'quiz:answer_ack', 'quiz:error'].forEach(
        (e) => socket.off(e)
      )
    }
  }, [])

  const join = useCallback((code: string, name: string) => {
    joinParamsRef.current = { code, name: name.trim() }
    setError(null)
    if (socketRef.current.connected) {
      socketRef.current.emit('quiz:participant_join', { code, name: name.trim() })
    }
  }, [])

  const answer = useCallback(
    (optionIndex: number, responseMs: number) => {
      if (!state?.sessionId || !participantIdRef.current || hasAnswered) return
      socketRef.current.emit('quiz:answer', {
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
