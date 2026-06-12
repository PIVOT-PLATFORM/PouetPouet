'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

// Atterrissage du callback OIDC : le token JWT arrive dans le fragment d'URL
// (#token=…) — jamais en query string, pour qu'il n'apparaisse ni dans les logs
// serveur ni dans le referrer.
export default function SsoPage() {
  const { adoptToken } = useAuthStore()
  const router = useRouter()
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    const params = new URLSearchParams(window.location.hash.slice(1))
    const token = params.get('token')
    if (!token) {
      router.replace('/login?error=sso')
      return
    }
    // Nettoie le fragment avant toute navigation
    window.history.replaceState(null, '', window.location.pathname)
    adoptToken(token)
      .then(() => router.replace('/hub'))
      .catch(() => router.replace('/login?error=sso'))
  }, [adoptToken, router])

  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500">Connexion en cours…</p>
    </div>
  )
}
