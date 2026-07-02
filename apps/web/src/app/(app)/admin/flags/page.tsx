'use client'

import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useFlagsStore } from '@/store/flags'
import { api } from '@/lib/api'
import type { AdminFlag } from '@pouetpouet/shared'

export default function AdminFlagsPage() {
  const { user } = useAuthStore()
  const [flags, setFlags] = useState<AdminFlag[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.isAdmin) return
    api.get<AdminFlag[]>('/api/admin/flags').then(setFlags).catch((e) => setError((e as Error).message))
  }, [user?.isAdmin])

  if (!user?.isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Accès réservé</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Cette page est réservée aux administrateurs.</p>
      </div>
    )
  }

  async function patch(key: string, body: { enabled?: boolean; rolloutPercent?: number }) {
    setSavingKey(key)
    setFlags((prev) => prev?.map((f) => (f.key === key ? { ...f, ...body } : f)) ?? prev) // optimiste
    try {
      await api.patch(`/api/admin/flags/${key}`, body)
      await useFlagsStore.getState().loadFlags() // rafraîchit le gating de la session courante
    } catch (e) {
      setError((e as Error).message)
      api.get<AdminFlag[]>('/api/admin/flags').then(setFlags).catch(() => {}) // resync sur échec
    } finally {
      setSavingKey(null)
    }
  }

  const env = flags?.[0]?.environment

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><Flag size={28} style={{ color: '#64748b' }} />Feature flags</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Activez, désactivez ou déployez progressivement des fonctionnalités sans redéploiement.
          {env && <> Environnement : <span className="font-mono font-semibold">{env}</span>.</>}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm px-4 py-2">{error}</div>
      )}

      {/* 2 flags par ligne pour balayer le catalogue d'un coup d'œil */}
      <div className="grid gap-3 md:grid-cols-2">
        {flags === null ? (
          <div className="text-sm text-gray-400">Chargement…</div>
        ) : (
          flags.map((f) => (
            <div key={f.key} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 dark:text-white">{f.label}</p>
                    <code className="text-[11px] text-gray-400">{f.key}</code>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{f.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={f.enabled}
                  aria-label={`Activer « ${f.label} »`}
                  disabled={savingKey === f.key}
                  onClick={() => patch(f.key, { enabled: !f.enabled })}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${f.enabled ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${f.enabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {f.enabled && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-32 shrink-0">
                    Déploiement {f.rolloutPercent}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={f.rolloutPercent}
                    onChange={(e) =>
                      setFlags((prev) => prev?.map((x) => (x.key === f.key ? { ...x, rolloutPercent: Number(e.target.value) } : x)) ?? prev)
                    }
                    onMouseUp={(e) => patch(f.key, { rolloutPercent: Number((e.target as HTMLInputElement).value) })}
                    onTouchEnd={(e) => patch(f.key, { rolloutPercent: Number((e.target as HTMLInputElement).value) })}
                    className="flex-1 accent-primary-600"
                    aria-label={`Pourcentage de déploiement de « ${f.label} »`}
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
