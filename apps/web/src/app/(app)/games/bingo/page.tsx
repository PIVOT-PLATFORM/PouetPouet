'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

const ALL_PHRASES = [
  "Vous êtes en sourdine",
  "Est-ce que vous m'entendez ?",
  "Je perds la connexion",
  "On peut mettre ça au parking ?",
  "On va en parler en bilatéral",
  "Quelqu'un peut partager son écran ?",
  "J'ai une question",
  "On reprend dans 5 minutes",
  "Qui prend les minutes ?",
  "Le son est désynchronisé",
  "Je vais couper ma caméra",
  "Vous êtes toujours là ?",
  "C'est en dehors du scope",
  "Le réseau est instable",
  "On va replanifier",
  "C'est noté dans l'ordre du jour",
  "Action item pour toi",
  "On aligne en offline",
  "ROI pas démontré",
  "Quick win",
  "On va synchro",
  "C'est acté",
  "On va déprioriser",
  "Impact nul",
  "Go/No-go ?",
  "On est en capacité ?",
  "C'est dans le backlog",
  "Sprint review à jeudi",
  "Vélocité insuffisante",
  "Burnout chart en retard",
  "Qui est bloqué ?",
  "Daily à 9h30",
  "Retrospective vendredi",
  "Point de synchro",
  "Réunion de cadrage",
  "Comité de pilotage",
  "Indicateur au rouge",
  "Plan B",
  "On escalade",
  "C'est critique",
  "Vous avez les accès ?",
  "On va pas refaire le monde",
  "C'est dans les specs",
  "Tu peux répéter ?",
  "Mon micro ne marche pas",
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const FREE_INDEX = 12 // center of 5x5

function generateGrid(): string[] {
  const picked = shuffle(ALL_PHRASES).slice(0, 24)
  const grid = [...picked]
  grid.splice(FREE_INDEX, 0, 'FREE')
  return grid
}

function checkBingo(checked: Set<number>): number[][] {
  const wins: number[][] = []

  // Rows
  for (let r = 0; r < 5; r++) {
    const row = [r * 5, r * 5 + 1, r * 5 + 2, r * 5 + 3, r * 5 + 4]
    if (row.every((i) => checked.has(i))) wins.push(row)
  }

  // Cols
  for (let c = 0; c < 5; c++) {
    const col = [c, c + 5, c + 10, c + 15, c + 20]
    if (col.every((i) => checked.has(i))) wins.push(col)
  }

  // Diagonals
  const d1 = [0, 6, 12, 18, 24]
  const d2 = [4, 8, 12, 16, 20]
  if (d1.every((i) => checked.has(i))) wins.push(d1)
  if (d2.every((i) => checked.has(i))) wins.push(d2)

  return wins
}

export default function BingoPage() {
  const [grid, setGrid] = useState<string[]>(() => generateGrid())
  const [checked, setChecked] = useState<Set<number>>(() => new Set([FREE_INDEX]))
  const [wins, setWins] = useState<number[][]>([])

  const winCells = new Set(wins.flat())

  const toggle = useCallback((i: number) => {
    if (i === FREE_INDEX) return
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(i)) {
        next.delete(i)
      } else {
        next.add(i)
      }
      setWins(checkBingo(next))
      return next
    })
  }, [])

  const newGame = useCallback(() => {
    setGrid(generateGrid())
    setChecked(new Set([FREE_INDEX]))
    setWins([])
  }, [])

  const hasBingo = wins.length > 0

  return (
    <div className="max-w-xl mx-auto space-y-6">
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
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">🎯 Bingo des Réunions</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Cochez les phrases que vous entendez en réunion</p>
        </div>
        <button
          onClick={newGame}
          className="ml-auto text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          Nouvelle partie
        </button>
      </div>

      {/* Win banner */}
      {hasBingo && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center animate-pulse">
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">🎉 BINGO !</p>
          <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
            {wins.length} ligne{wins.length > 1 ? 's' : ''} complète{wins.length > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-5 gap-1.5">
        {/* Column headers */}
        {['B', 'I', 'N', 'G', 'O'].map((l) => (
          <div key={l} className="text-center font-bold text-primary-600 dark:text-primary-400 text-sm py-1">
            {l}
          </div>
        ))}

        {/* Cells */}
        {grid.map((phrase, i) => {
          const isFree = i === FREE_INDEX
          const isChecked = checked.has(i)
          const isWin = winCells.has(i)

          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              disabled={isFree}
              className={[
                'aspect-square rounded-lg flex items-center justify-center p-1 text-[9px] sm:text-[10px] leading-tight text-center font-medium transition-all select-none',
                isFree
                  ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 cursor-default font-bold text-xs'
                  : isWin && isChecked
                  ? 'bg-emerald-500 dark:bg-emerald-600 text-white shadow-md scale-105'
                  : isChecked
                  ? 'bg-primary-500 dark:bg-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/30 cursor-pointer',
              ].join(' ')}
            >
              {isFree ? '★ FREE' : phrase}
            </button>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        Cliquez sur une case pour la cocher · Ligne, colonne ou diagonale = Bingo
      </p>
    </div>
  )
}
