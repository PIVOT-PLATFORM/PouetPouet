'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function RegisterPage() {
  const { register, isLoading, error, clearError } = useAuthStore()
  const router = useRouter()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({})

  function validate() {
    const errors: typeof fieldErrors = {}
    if (!name || name.length < 2) errors.name = 'Minimum 2 caractères'
    if (!email) errors.email = 'Champ requis'
    if (!password || password.length < 8) errors.password = 'Minimum 8 caractères'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearError()
    if (!validate()) return
    try {
      await register(name, email, password)
      router.push('/dashboard')
    } catch {
      // error géré dans le store
    }
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Créer un compte</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        <p className="text-xs text-center text-gray-400 leading-relaxed">
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
