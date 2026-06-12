'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { useAuthHydrated } from '@/hooks/useAuthHydrated'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore()
  const hydrated = useAuthHydrated()
  const router = useRouter()

  useEffect(() => {
    if (hydrated && token) router.replace('/hub')
  }, [hydrated, token, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-800 flex items-center justify-center p-4">
      {/* Cercles décoratifs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-white/5" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <span className="text-3xl">🎯</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">PouetPouet</h1>
          <p className="text-primary-200 text-sm mt-1">Outil collaboratif interactif</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {children}
        </div>

        <nav className="mt-6 flex items-center justify-center gap-4 text-xs text-primary-200">
          <Link href="/mentions-legales" className="hover:text-white transition-colors">
            Mentions légales
          </Link>
          <Link href="/confidentialite" className="hover:text-white transition-colors">
            Confidentialité
          </Link>
          <Link href="/cgu" className="hover:text-white transition-colors">
            CGU
          </Link>
        </nav>
      </div>
    </div>
  )
}
