'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { Logo } from '@/components/ui/logo'

function Avatar({ name, src }: { name: string; src?: string | null }) {
  if (src) {
    return <img src={src} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-white dark:ring-gray-800" />
  }
  const initials = name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { token, user, logout } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  // Sync dark mode class on html element whenever theme changes
  useEffect(() => {
    if (!user) return
    if (user.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [user?.theme])

  if (!token || !user) return null

  const isBoardPage = pathname.startsWith('/boards/')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 grid grid-rows-[auto_1fr_auto]">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
        <div className={`flex items-center h-14 gap-4 ${isBoardPage ? 'px-4' : 'px-6 max-w-6xl mx-auto'}`}>
          <Link href="/dashboard">
            <Logo />
          </Link>

          {!isBoardPage && (
            <nav className="flex items-center gap-1 ml-2">
              <Link
                href="/dashboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === '/dashboard'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Mes boards
              </Link>
              <Link
                href="/daily"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith('/daily')
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Mes dailys
              </Link>
              <Link
                href="/scrum"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith('/scrum')
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Scrum Poker
              </Link>
              <Link
                href="/wheel"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith('/wheel')
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                La roue
              </Link>
              <Link
                href="/equipes"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith('/equipes')
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Mes équipes
              </Link>
            </nav>
          )}

          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">{user.name}</span>
            <Link href="/profile" title="Mon profil" className="hover:opacity-80 transition-opacity">
              <Avatar name={user.name} src={user.avatar} />
            </Link>
            <button
              onClick={() => { logout(); router.push('/login') }}
              className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className={isBoardPage ? '' : 'w-full max-w-6xl mx-auto px-6 py-8'}>
        {children}
      </main>

      {!isBoardPage && (
        <footer className="border-t border-gray-100 dark:border-gray-800 mt-8">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
            <span className="text-xs text-gray-400 dark:text-gray-600">
              © {new Date().getFullYear()} PouetPouet
            </span>
            <span className="text-xs text-gray-300 dark:text-gray-700">
              Fait avec ☕ par l'équipe
            </span>
          </div>
        </footer>
      )}
    </div>
  )
}
