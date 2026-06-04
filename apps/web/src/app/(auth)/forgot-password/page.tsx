'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuthStore()

  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [devLink, setDevLink] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError(null)
    try {
      const res = await forgotPassword(email)
      if (res.devLink) setDevLink(res.devLink)
      setSubmitted(true)
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <>
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Vérifiez vos emails</h2>
        </div>
        <p className="text-sm text-gray-600 text-center mb-2">
          Si un compte existe pour <span className="font-medium text-gray-900">{email}</span>, vous allez recevoir un lien de réinitialisation sous peu.
        </p>
        <p className="text-xs text-gray-400 text-center mb-6">Le lien est valable 1 heure.</p>

        {devLink && (
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 break-all">
            <p className="font-medium mb-1">Dev — SMTP non configuré</p>
            <a href={devLink} className="underline">{devLink}</a>
          </div>
        )}

        <p className="text-center text-sm text-gray-500">
          <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Retour à la connexion
          </Link>
        </p>
      </>
    )
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Mot de passe oublié</h2>
      <p className="text-sm text-gray-500 mb-6">
        Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Adresse email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.fr"
          autoComplete="email"
        />
        <Button type="submit" isLoading={loading} className="w-full mt-2">
          Envoyer le lien
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
          Retour à la connexion
        </Link>
      </p>
    </>
  )
}
