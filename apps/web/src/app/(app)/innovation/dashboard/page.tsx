'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BarChart2, Lightbulb, ThumbsUp, Trophy, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { useFlagGuard } from '@/hooks/useFlagGuard'

interface InnovationStats {
  totalFiches: number
  recentFiches: number
  byStatus: Record<string, number>
  byCategory: { label: string; count: number }[]
  challenges: Record<string, number>
  contributorCount: number
  topFiches: { id: string; title: string; status: string; author: { id: string; name: string }; votes: number }[]
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  IDEE: { label: 'Idées', color: '#eab308' },
  EXPLORATION: { label: 'En exploration', color: '#2563eb' },
  ADOPTEE: { label: 'Adoptées', color: '#16a34a' },
  ABANDONNEE: { label: 'Abandonnées', color: '#6b7280' },
}

const CHALLENGE_META: Record<string, string> = {
  DRAFT: 'Brouillons',
  OPEN: 'Ouverts',
  EVALUATION: 'En évaluation',
  CLOSED: 'Clôturés',
}

function Tile({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-400">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{value}</p>
    </div>
  )
}

export default function InnovationDashboardPage() {
  useFlagGuard('module.innovation')
  const [stats, setStats] = useState<InnovationStats | null>(null)

  useEffect(() => {
    api.get<InnovationStats>('/api/innovation/stats').then(setStats).catch(() => {})
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><BarChart2 size={28} style={{ color: '#eab308' }} />Dashboard Innovation</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Vue d'ensemble des fiches, challenges et contributeurs</p>
      </div>

      <div className="flex items-center gap-4 border-b border-gray-100 dark:border-gray-800 -mt-2">
        <Link href="/innovation" className="text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 pb-2">Fiches</Link>
        <Link href="/innovation/challenges" className="text-sm font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 pb-2">Challenges</Link>
        <span className="text-sm font-semibold text-gray-900 dark:text-white border-b-2 border-amber-500 pb-2">Dashboard</span>
      </div>

      {!stats ? (
        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Tuiles principales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Tile label="Fiches" value={stats.totalFiches} icon={<Lightbulb size={14} />} />
            <Tile label="Sur 30 jours" value={`+${stats.recentFiches}`} />
            <Tile label="Contributeurs" value={stats.contributorCount} icon={<Users size={14} />} />
            <Tile label="Challenges ouverts" value={stats.challenges.OPEN ?? 0} icon={<Trophy size={14} />} />
          </div>

          {/* Répartition par statut */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Maturation des fiches</h2>
            <div className="flex flex-col gap-2">
              {Object.entries(STATUS_META).map(([key, meta]) => {
                const count = stats.byStatus[key] ?? 0
                const pct = stats.totalFiches > 0 ? Math.round((count / stats.totalFiches) * 100) : 0
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-32 text-sm text-gray-600 dark:text-gray-300 shrink-0">{meta.label}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold text-gray-900 dark:text-gray-100 shrink-0">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top fiches */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Top fiches (votes)</h2>
              {stats.topFiches.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune fiche pour l'instant.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {stats.topFiches.map((f, i) => (
                    <li key={f.id}>
                      <Link href={`/innovation/${f.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <span className="w-5 text-sm font-bold text-gray-300 dark:text-gray-600 shrink-0">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{f.title}</p>
                          <p className="text-xs text-gray-400">{f.author.name}</p>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0"><ThumbsUp size={11} />{f.votes}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/* Catégories + challenges */}
            <div className="flex flex-col gap-4">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Par catégorie</h2>
                {stats.byCategory.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucune fiche pour l'instant.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {stats.byCategory.map((c) => (
                      <span key={c.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                        {c.label} <span className="font-bold">{c.count}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Challenges</h2>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(CHALLENGE_META).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{stats.challenges[key] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
