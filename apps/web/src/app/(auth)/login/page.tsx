'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { ApiError, api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const { login, resendVerification, isLoading, error, clearError } = useAuthStore()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  // Set when the server rejects login because the email isn't verified yet.
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resent, setResent] = useState(false)

  // SSO (OIDC) — bouton affiché seulement si l'API a un IdP configuré
  const [ssoProvider, setSsoProvider] = useState<string | null>(null)
  const [ssoError, setSsoError] = useState(false)

  useEffect(() => {
    api.get<{ enabled: boolean; provider: string }>('/api/auth/oidc/enabled')
      .then((res) => { if (res.enabled) setSsoProvider(res.provider) })
      .catch(() => {})
    if (new URLSearchParams(window.location.search).get('error') === 'sso') setSsoError(true)
  }, [])

  function validate() {
    const errors: typeof fieldErrors = {}
    if (!email) errors.email = 'Champ requis'
    if (!password) errors.password = 'Champ requis'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    setNeedsVerification(false)
    if (!validate()) return
    try {
      await login(email, password)
      router.push('/hub')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true)
        clearError()
      }
      // autres erreurs gérées via le store
    }
  }

  async function handleResend() {
    await resendVerification(email)
    setResent(true)
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Connexion</h2>

      {error && !needsVerification && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {ssoError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          La connexion SSO a échoué. Réessayez ou utilisez votre mot de passe.
        </div>
      )}

      {needsVerification && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium mb-1">Email non vérifié</p>
          <p className="text-amber-700">
            Vérifiez votre boîte mail pour activer votre compte, puis reconnectez-vous.
          </p>
          <button
            onClick={handleResend}
            className="mt-2 font-medium text-amber-800 underline hover:text-amber-900"
          >
            {resent ? 'Email renvoyé ✓' : 'Renvoyer l\'email de vérification'}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Adresse email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          placeholder="vous@exemple.fr"
          autoComplete="email"
        />
        <div>
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <div className="mt-1.5 text-right">
            <Link href="/forgot-password" className="text-xs text-primary-600 hover:text-primary-700">
              Mot de passe oublié ?
            </Link>
          </div>
        </div>
        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Se connecter
        </Button>
      </form>

      {ssoProvider && (
        <>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">ou</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/auth/oidc/login`}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            Se connecter avec {ssoProvider}
          </a>
        </>
      )}

      <p className="mt-6 text-center text-sm text-gray-500">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium text-primary-600 hover:text-primary-700">
          Créer un compte
        </Link>
      </p>
    </>
  )
}
