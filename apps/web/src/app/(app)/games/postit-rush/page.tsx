'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

const COLORS = [
  { bg: 'bg-yellow-200', shadow: 'shadow-yellow-300', text: 'text-yellow-900' },
  { bg: 'bg-green-200', shadow: 'shadow-green-300', text: 'text-green-900' },
  { bg: 'bg-pink-200', shadow: 'shadow-pink-300', text: 'text-pink-900' },
  { bg: 'bg-blue-200', shadow: 'shadow-blue-300', text: 'text-blue-900' },
  { bg: 'bg-orange-200', shadow: 'shadow-orange-300', text: 'text-orange-900' },
]

const TEXTS = [
  'Fix bug #42', 'Write tests', 'Update docs', 'Code review', 'Deploy to prod',
  'Merge PR', 'Sprint planning', 'Stand-up', 'Backlog grooming', 'Refactor auth',
  'Add unit tests', 'Update README', 'Close sprint', 'Retro notes', 'User story',
  'Estimate tasks', 'Demo prep', 'Fix flaky test', 'CI pipeline', 'Release notes',
  'Performance audit', 'Design review', 'Security scan', 'DB migration', 'Log cleanup',
]

const LS_KEY = 'pivot:highscore:postit'
const GAME_DURATION = 60
const SPAWN_INTERVAL_INITIAL = 800
const SPAWN_INTERVAL_FAST = 500
const POSTIT_LIFETIME = 3000

type PostIt = {
  id: number
  x: number
  y: number
  text: string
  color: (typeof COLORS)[number]
  createdAt: number
}

function loadHighScore(): number {
  try {
    return parseInt(localStorage.getItem(LS_KEY) ?? '0', 10) || 0
  } catch {
    return 0
  }
}

function saveHighScore(score: number) {
  try {
    localStorage.setItem(LS_KEY, String(score))
  } catch {
    // ignore
  }
}

type Phase = 'idle' | 'playing' | 'done'

export default function PostItRushPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [score, setScore] = useState(0)
  const [concentration, setConcentration] = useState(10)
  const [combo, setCombo] = useState(0)
  const [postIts, setPostIts] = useState<PostIt[]>([])
  const [highScore, setHighScore] = useState(0)
  const [lastComboBonus, setLastComboBonus] = useState(0)

  const idRef = useRef(0)
  const comboRef = useRef(0)
  const scoreRef = useRef(0)
  const concentrationRef = useRef(10)
  const areaRef = useRef<HTMLDivElement>(null)
  const spawnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseRef = useRef<Phase>('idle')

  // keep refs in sync
  useEffect(() => { comboRef.current = combo }, [combo])
  useEffect(() => { scoreRef.current = score }, [score])
  useEffect(() => { concentrationRef.current = concentration }, [concentration])
  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    setHighScore(loadHighScore())
  }, [])

  const spawnPostIt = useCallback(() => {
    if (phaseRef.current !== 'playing') return
    const area = areaRef.current
    if (!area) return
    const { width, height } = area.getBoundingClientRect()
    const size = 96
    const x = Math.random() * Math.max(0, width - size)
    const y = Math.random() * Math.max(0, height - size)
    const text = TEXTS[Math.floor(Math.random() * TEXTS.length)]
    const color = COLORS[Math.floor(Math.random() * COLORS.length)]
    const id = ++idRef.current

    setPostIts((prev) => [
      ...prev,
      { id, x, y, text, color, createdAt: Date.now() },
    ])

    // Auto-remove after lifetime + fade (3s + 0.5s fade)
    setTimeout(() => {
      setPostIts((prev) => {
        const stillThere = prev.some((p) => p.id === id)
        if (stillThere && phaseRef.current === 'playing') {
          // missed
          setConcentration((c) => Math.max(0, c - 1))
          concentrationRef.current = Math.max(0, concentrationRef.current - 1)
          comboRef.current = 0
          setCombo(0)
        }
        return prev.filter((p) => p.id !== id)
      })
    }, POSTIT_LIFETIME)
  }, [])

  const startSpawning = useCallback((fast: boolean) => {
    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)
    const interval = fast ? SPAWN_INTERVAL_FAST : SPAWN_INTERVAL_INITIAL
    spawnTimerRef.current = setInterval(spawnPostIt, interval)
  }, [spawnPostIt])

  const stopAll = useCallback(() => {
    if (spawnTimerRef.current) { clearInterval(spawnTimerRef.current); spawnTimerRef.current = null }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null }
  }, [])

  const endGame = useCallback(() => {
    stopAll()
    setPhase('done')
    phaseRef.current = 'done'
    setPostIts([])
    const final = scoreRef.current
    setHighScore((prev) => {
      const next = Math.max(prev, final)
      saveHighScore(next)
      return next
    })
  }, [stopAll])

  const startGame = useCallback(() => {
    setPhase('playing')
    phaseRef.current = 'playing'
    setTimeLeft(GAME_DURATION)
    setScore(0)
    scoreRef.current = 0
    setConcentration(10)
    concentrationRef.current = 10
    setCombo(0)
    comboRef.current = 0
    setPostIts([])
    setLastComboBonus(0)

    // First spawn immediately
    setTimeout(spawnPostIt, 100)
    startSpawning(false)

    let elapsed = 0
    countdownRef.current = setInterval(() => {
      elapsed += 1
      setTimeLeft(GAME_DURATION - elapsed)

      if (elapsed === 30) {
        startSpawning(true)
      }

      if (elapsed >= GAME_DURATION) {
        endGame()
      }
    }, 1000)
  }, [spawnPostIt, startSpawning, endGame])

  const clickPostIt = useCallback((id: number) => {
    setPostIts((prev) => {
      if (!prev.some((p) => p.id === id)) return prev
      comboRef.current += 1
      const newCombo = comboRef.current
      setCombo(newCombo)

      const bonus = newCombo >= 3 ? 5 : 0
      const points = 10 + bonus
      scoreRef.current += points
      setScore(scoreRef.current)
      if (bonus > 0) setLastComboBonus(newCombo)

      return prev.filter((p) => p.id !== id)
    })
  }, [])

  // cleanup on unmount
  useEffect(() => () => stopAll(), [stopAll])

  const concentrationBars = Array.from({ length: 10 }, (_, i) => i < concentration)

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/games"
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title="Retour aux jeux"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">📝 Post-it Rush</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cliquez sur les post-its avant qu&apos;ils disparaissent</p>
        </div>
      </div>

      {/* Stats bar */}
      {phase !== 'idle' && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center gap-6 flex-wrap">
          {/* Timer */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Temps</span>
            <span className={`font-mono font-bold text-lg ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-900 dark:text-white'}`}>
              {timeLeft}s
            </span>
          </div>
          {/* Score */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Score</span>
            <span className="font-bold text-lg text-primary-600 dark:text-primary-400">{score}</span>
          </div>
          {/* Combo */}
          {combo >= 2 && (
            <div className="flex items-center gap-1">
              <span className="text-xs font-medium text-orange-500">x{combo} combo</span>
              {combo >= 3 && (
                <span className="text-[10px] bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 px-1 rounded font-medium">
                  +5 bonus
                </span>
              )}
            </div>
          )}
          {/* Concentration */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-gray-500 dark:text-gray-400">Concentration</span>
            <div className="flex gap-0.5">
              {concentrationBars.map((filled, i) => (
                <div
                  key={i}
                  className={`w-2 h-3 rounded-sm ${filled ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Game area */}
      <div
        ref={areaRef}
        className="relative bg-gray-100 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 overflow-hidden"
        style={{ height: '380px' }}
      >
        {phase === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            {highScore > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Meilleur score : <span className="font-bold text-primary-600 dark:text-primary-400">{highScore}</span>
              </p>
            )}
            <button
              onClick={startGame}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm shadow"
            >
              Lancer la partie
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-4">
              60 secondes · +10 pts par post-it · +5 bonus de combo (×3 consécutifs)
            </p>
          </div>
        )}

        {phase === 'done' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
            <div className="text-4xl">🏁</div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{score} pts</p>
              {score >= highScore && score > 0 && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1">Nouveau record !</p>
              )}
              {highScore > 0 && score < highScore && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Meilleur : {highScore}</p>
              )}
            </div>
            <button
              onClick={startGame}
              className="bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
            >
              Rejouer
            </button>
          </div>
        )}

        {/* Post-its */}
        {phase === 'playing' && postIts.map((p) => {
          const age = Date.now() - p.createdAt
          // Start fading at 2s, fully gone at 3s
          const opacity = age < 2000 ? 1 : Math.max(0, 1 - (age - 2000) / 1000)

          return (
            <button
              key={p.id}
              onClick={() => clickPostIt(p.id)}
              style={{
                left: p.x,
                top: p.y,
                opacity,
                transition: 'opacity 0.3s linear',
              }}
              className={[
                'absolute w-24 h-24 flex items-center justify-center text-center text-[10px] font-medium leading-tight px-1.5',
                'rounded shadow-md cursor-pointer select-none',
                'hover:scale-105 active:scale-95',
                p.color.bg,
                p.color.shadow,
                p.color.text,
                'transition-transform',
              ].join(' ')}
            >
              {p.text}
            </button>
          )
        })}

        {/* Combo flash */}
        {lastComboBonus >= 3 && phase === 'playing' && (
          <div className="absolute top-2 right-2 text-xs font-bold text-orange-500 bg-orange-100 dark:bg-orange-950/50 px-2 py-1 rounded-lg animate-bounce pointer-events-none">
            COMBO x{combo}!
          </div>
        )}
      </div>
    </div>
  )
}
