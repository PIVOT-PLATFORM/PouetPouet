'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

// ── Pourquoi un bouton et non un useEffect auto ?
// Les scanners de sécurité email (Outlook SafeLinks, etc.) préchargent
// automatiquement tous les liens d'un email à sa réception pour détecter
// le phishing. Sans cette protection, le scanner consomme le token avant
// que l'utilisateur clique, rendant le lien "expiré" à tort.
// Un bouton ne peut pas être déclenché par un préchargeur HTTP.

function VerifyEmailInner() {
  const params = useSearchParams()
  const token = params.get('token')
  const verifyEmail = useAuthStore((s) => s.verifyEmail)

  const [state, setState] = useState<'idle' | 'verifying' | 'error'>('idle')
  const [message, setMessage] = useState('')

  if (!token) {
    return (
      <div className="text-center">
        <ErrorIcon />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Lien invalide</h2>
        <p className="text-sm text-gray-500">Le lien de vérification est manquant ou malformé.</p>
        <Links />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="text-center">
        <ErrorIcon />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Vérification impossible</h2>
        <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
        <Links />
      </div>
    )
  }

  async function handleVerify() {
    setState('verifying')
    try {
      await verifyEmail(token!)
      // On success, the (auth) layout sees the new token and redirects to /hub.
    } catch (err) {
      setState('error')
      setMessage((err as Error)?.message ?? 'Lien invalide ou expiré.')
    }
  }

  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
        <svg className="h-7 w-7 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Confirmer votre adresse email</h2>
      <p className="text-sm text-gray-500 mb-6">Cliquez sur le bouton ci-dessous pour activer votre compte.</p>
      <button
        onClick={handleVerify}
        disabled={state === 'verifying'}
        className="w-full py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 transition-colors"
      >
        {state === 'verifying' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Vérification…
          </span>
        ) : 'Vérifier mon adresse email'}
      </button>
      <div className="mt-4">
        <Link href="/login" className="text-sm text-gray-400 hover:text-gray-600">
          Aller à la connexion
        </Link>
      </div>
    </div>
  )
}

function ErrorIcon() {
  return (
    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
      <svg className="h-7 w-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  )
}

function Links() {
  return (
    <div className="mt-6 flex flex-col gap-3">
      <Link href="/login" className="text-sm font-medium text-primary-600 hover:text-primary-700">
        Aller à la connexion
      </Link>
      <Link href="/register" className="text-sm text-gray-400 hover:text-gray-600">
        Créer un nouveau compte
      </Link>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-4">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  )
}
