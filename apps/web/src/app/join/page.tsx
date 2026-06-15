'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (clean.length !== 6) { setError('Le code fait 6 caractères'); return }
    router.push(`/session/${clean}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-2xl font-bold text-white">PIVOT</h1>
          <p className="text-primary-200 text-sm mt-1">Rejoindre une session</p>
        </div>

        <div className="bg-white rounded-2xl p-7 shadow-2xl">
          <h2 className="text-base font-semibold text-gray-900 mb-6 text-center">
            Entrez le code de la session
          </h2>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')); setError(null) }}
              maxLength={6}
              placeholder="ABC123"
              autoFocus
              className="text-center text-3xl font-bold tracking-[0.35em] font-mono uppercase rounded-xl border border-gray-200 px-4 py-4 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-primary-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all"
            >
              Rejoindre →
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-4">Aucun compte requis</p>
        </div>
      </div>
    </div>
  )
}

export default function JoinPage() {
  return <Suspense><JoinForm /></Suspense>
}
