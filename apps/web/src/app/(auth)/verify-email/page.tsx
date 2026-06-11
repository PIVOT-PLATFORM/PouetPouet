'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

function VerifyEmailInner() {
  const params = useSearchParams()
  const token = params.get('token')
  const verifyEmail = useAuthStore((s) => s.verifyEmail)

  // 'verifying' → calling the API; 'error' → bad/expired link.
  // On success the (auth) layout sees the new token and redirects to /hub.
  const [state, setState] = useState<'verifying' | 'error'>('verifying')
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    if (!token) {
      setState('error')
      setMessage('Lien de vérification manquant.')
      return
    }
    verifyEmail(token).catch((err) => {
      setState('error')
      setMessage(err?.message ?? 'Lien invalide ou expiré.')
    })
  }, [token, verifyEmail])

  if (state === 'verifying') {
    return (
      <div className="text-center py-4">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <h2 className="text-lg font-semibold text-gray-900">Vérification en cours…</h2>
        <p className="text-sm text-gray-500 mt-1">Activation de votre compte.</p>
      </div>
    )
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
        <svg className="h-7 w-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Vérification impossible</h2>
      <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
      <div className="mt-6 flex flex-col gap-3">
        <Link href="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
          Aller à la connexion
        </Link>
        <Link href="/register" className="text-sm text-gray-400 hover:text-gray-600">
          Créer un nouveau compte
        </Link>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-4">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  )
}
