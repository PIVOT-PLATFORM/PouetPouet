'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function ResetPasswordForm() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const { resetPassword } = useAuthStore()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)

  if (!token) {
    return (
      <>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Lien invalide</h2>
        <p className="text-sm text-gray-500 mb-6">Ce lien de réinitialisation est invalide ou a expiré.</p>
        <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-700 text-sm">
          Demander un nouveau lien
        </Link>
      </>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldError(null)
    if (password.length < 8) {
      setFieldError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setFieldError('Les mots de passe ne correspondent pas.')
      return
    }
    setLoading(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_TOKEN') {
        setError('Ce lien est invalide ou a expiré. Demandez un nouveau lien.')
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Mot de passe modifié</h2>
        </div>
        <p className="text-sm text-gray-500 text-center mb-6">
          Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.
        </p>
        <Link
          href="/login"
          className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm py-2.5 rounded-xl transition-colors"
        >
          Se connecter
        </Link>
      </>
    )
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Nouveau mot de passe</h2>
      <p className="text-sm text-gray-500 mb-6">Choisissez un nouveau mot de passe pour votre compte.</p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          {error.includes('expiré') && (
            <span> <Link href="/forgot-password" className="underline font-medium">Demander un nouveau lien</Link></span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nouveau mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          error={fieldError ?? undefined}
        />
        <Input
          label="Confirmer le mot de passe"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <Button type="submit" isLoading={loading} className="w-full mt-2">
          Enregistrer le mot de passe
        </Button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
