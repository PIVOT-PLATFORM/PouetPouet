'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuthStore()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

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
    if (!validate()) return
    try {
      await login(email, password)
      router.push('/dashboard')
    } catch {
      // error géré dans le store
    }
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Connexion</h2>

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
          autoComplete="current-password"
        />
        <Button type="submit" isLoading={isLoading} className="w-full mt-2">
          Se connecter
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Pas encore de compte ?{' '}
        <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-700">
          Créer un compte
        </Link>
      </p>
    </>
  )
}
