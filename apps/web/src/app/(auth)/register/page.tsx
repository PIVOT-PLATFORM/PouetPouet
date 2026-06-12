'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ALLOW_BYPASS = process.env.NEXT_PUBLIC_ALLOW_EMAIL_BYPASS === 'true'

export default function RegisterPage() {
  const { register, resendVerification, isLoading, error, clearError } = useAuthStore()
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({})

  // Set once registration succeeds but the account still needs email verification.
  const [pending, setPending] = useState<{ email: string; emailSent: boolean; devLink?: string } | null>(null)
  const [resent, setResent] = useState(false)

  function validate() {
    const errors: typeof fieldErrors = {}
    if (!name || name.length < 2) errors.name = 'Minimum 2 caractères'
    if (!email) errors.email = 'Champ requis'
    if (!password || password.length < 8) errors.password = 'Minimum 8 caractères'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function submit(bypass: boolean) {
    clearError()
    if (!validate()) return
    try {
      const result = await register(name, email, password, bypass)
      if (result.status === 'logged-in') {
        router.push('/hub')
      } else {
        setPending({ email: result.email, emailSent: result.emailSent, devLink: result.devLink })
      }
    } catch {
      // error géré dans le store
    }
  }

  async function handleResend() {
    if (!pending) return
    const { devLink } = await resendVerification(pending.email)
    setPending({ ...pending, devLink: devLink ?? pending.devLink })
    setResent(true)
  }

  // ── Confirmation screen ──────────────────────────────────────────────────────
  if (pending) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
          <svg className="h-7 w-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Vérifiez votre email</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          {pending.emailSent ? (
            <>Un lien de vérification a été envoyé à <span className="font-medium text-gray-700">{pending.email}</span>. Cliquez dessus pour activer votre compte.</>
          ) : (
            <>Votre compte a été créé pour <span className="font-medium text-gray-700">{pending.email}</span>. L&apos;envoi d&apos;email n&apos;est pas configuré sur ce serveur.</>
          )}
        </p>

        {pending.devLink && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
            <p className="text-xs font-semibold text-amber-700 mb-1">Lien de vérification (mode test)</p>
            <a href={pending.devLink} className="text-xs text-amber-800 underline break-all">{pending.devLink}</a>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleResend}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            {resent ? 'Email renvoyé ✓' : 'Renvoyer l\'email'}
          </button>
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700">
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  // ── Registration form ──────────────────────────────────────────────────────────
  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Créer un compte</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); submit(false) }} className="flex flex-col gap-4">
        <Input
          label="Nom complet"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          placeholder="Jean Dupont"
          autoComplete="name"
        />
        <Input
          label="Adresse email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          placeholder="vous@exemple.fr"
          autoComplete="email"
        />
        <Input
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Créer mon compte
        </Button>

        {ALLOW_BYPASS && (
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={isLoading}
            className="w-full rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
          >
            ⚡ Créer sans vérification (mode test)
          </button>
        )}

        <p className="text-xs text-center text-gray-500 leading-relaxed">
          En créant un compte, vous acceptez nos{' '}
          <Link href="/cgu" className="text-indigo-600 hover:text-indigo-700 underline">
            conditions générales d&apos;utilisation
          </Link>{' '}
          et notre{' '}
          <Link href="/confidentialite" className="text-indigo-600 hover:text-indigo-700 underline">
            politique de confidentialité
          </Link>
          .
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Déjà un compte ?{' '}
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
          Se connecter
        </Link>
      </p>
    </>
  )
}
