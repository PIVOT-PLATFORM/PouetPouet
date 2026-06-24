'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { tokenTimes } from '@/lib/jwt'
import { useAuthHydrated } from '@/hooks/useAuthHydrated'
import { Logo } from '@/components/ui/logo'
import { SessionExpiredModal } from '@/components/session-expired-modal'
import { SessionCountdown } from '@/components/session-countdown'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { useNotificationsStore } from '@/store/notifications'
import { useFlagsStore } from '@/store/flags'
import { APP_VERSION } from '@/lib/version'

function Avatar({ name, src }: { name: string; src?: string | null }) {
  if (src) {
    return <img src={src} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-white dark:ring-gray-800" />
  }
  const initials = name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
      {initials}
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { token, user, logout, expireSession, refreshSession, sessionExpired } = useAuthStore()
  const hydrated = useAuthHydrated()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (hydrated && !token) router.replace('/login')
  }, [hydrated, token, router])

  // Charge les feature flags évalués pour l'utilisateur courant (gating UI).
  useEffect(() => {
    if (token) void useFlagsStore.getState().loadFlags()
  }, [token])

  // Horodatage de la dernière activité utilisateur. Capture-phase + scroll inclus
  // pour attraper même les événements stoppés par stopPropagation (board canvas)
  // ou émis par un conteneur scrollable interne (le scroll ne bulle pas, mais la
  // phase de capture sur window le reçoit tout de même).
  const lastActivityRef = useRef(Date.now())
  useEffect(() => {
    const bump = () => { lastActivityRef.current = Date.now() }
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'pointerdown'] as const
    events.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }))
    return () => events.forEach((e) => window.removeEventListener(e, bump, { capture: true }))
  }, [])

  // Session glissante robuste :
  // - Refresh PROACTIF à la mi-vie (minuterie), sans dépendre d'un événement DOM —
  //   tant que l'utilisateur a été actif pendant la 1re moitié de vie du token.
  //   Un onglet totalement inactif ne se renouvelle pas → il finit par lapser.
  // - Refresh aussi au retour de veille / ré-affichage de l'onglet (visibilitychange,
  //   focus), pour rattraper une minuterie qui aurait été gelée.
  // - Le serveur reste seul juge de l'expiration : à l'échéance, on tente un dernier
  //   refresh si l'utilisateur est actif ; on n'affiche « session expirée » que si le
  //   token est réellement périmé (inactif) — ce qui neutralise un décalage d'horloge.
  useEffect(() => {
    if (!token) return
    const times = tokenTimes(token)
    if (times == null) return
    const now = Date.now()
    if (times.exp <= now) { logout(); return }

    const halfLife = times.iat + (times.exp - times.iat) / 2
    // L'utilisateur a-t-il été actif pendant la 1re moitié de vie du token ?
    const activeThisCycle = () => lastActivityRef.current >= times.iat
    let refreshed = false
    let retries = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const MAX_RETRIES = 5
    const RETRY_MS = 30_000

    // Tente le renouvellement ; en cas d'échec transitoire (réseau, cold start),
    // réessaie quelques fois plutôt que d'abandonner la session sur un seul échec.
    const doRefresh = async () => {
      if (refreshed) return
      if (useAuthStore.getState().sessionExpired) return
      if (!activeThisCycle()) return // inactif → on laisse lapser
      refreshed = true
      const ok = await refreshSession()
      if (ok) return // succès → le token change, l'effet se ré-arme tout seul
      // Échec : autoriser une nouvelle tentative tant que le token n'est pas périmé.
      if (retries < MAX_RETRIES && Date.now() < times.exp) {
        retries += 1
        refreshed = false
        retryTimer = setTimeout(doRefresh, RETRY_MS)
      }
    }

    const refreshTimer = setTimeout(doRefresh, Math.max(0, halfLife - now))
    // Gardien final à l'échéance : un dernier refresh si l'utilisateur est actif
    // (le serveur tranche : succès → on continue, ce qui neutralise un décalage
    // d'horloge) ; on n'expire que si le token est réellement rejeté ou inactif.
    const expireTimer = setTimeout(async () => {
      if (useAuthStore.getState().sessionExpired) return
      if (activeThisCycle() && (await refreshSession())) return
      expireSession()
    }, Math.max(0, times.exp - now))

    const onWake = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() >= halfLife) void doRefresh()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('focus', onWake)

    return () => {
      clearTimeout(refreshTimer)
      clearTimeout(expireTimer)
      if (retryTimer) clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('focus', onWake)
    }
  }, [token, refreshSession, expireSession, logout])

  // Sync dark mode class on html element whenever theme changes
  useEffect(() => {
    if (!user) return
    if (user.theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [user?.theme])

  // Palette de couleurs : data-palette pilote les variables CSS primary/secondary
  useEffect(() => {
    if (!user) return
    if (user.palette && user.palette !== 'default') {
      document.documentElement.setAttribute('data-palette', user.palette)
    } else {
      document.documentElement.removeAttribute('data-palette')
    }
  }, [user?.palette])

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!token || !user) return null

  const isBoardPage = pathname.startsWith('/boards/')

  return (
    // overflow-clip (pas hidden) sur les pages board : un conteneur overflow-hidden reste
    // scrollable programmatiquement (focus/scrollIntoView), ce qui désynchronisait le
    // viewport du board (getBoundingClientRect().left négatif). clip interdit tout scroll.
    <div className={`bg-gray-50 dark:bg-gray-950 grid grid-rows-[auto_1fr_auto] ${isBoardPage ? 'h-screen overflow-clip' : 'min-h-screen'}`}>
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
        <div className={`flex items-center h-14 gap-4 ${isBoardPage ? 'px-4' : 'px-6 max-w-6xl mx-auto'}`}>
          {/* Logo with the app version as a small superscript, clickable to open the release notes. */}
          <div className="flex items-start gap-0.5">
            <Link href="/hub">
              <Logo />
            </Link>
            <button
              onClick={() => useNotificationsStore.getState().openPatchNotes()}
              title="Notes de version"
              className="text-[10px] font-mono font-bold leading-none text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 transition-colors cursor-pointer"
            >
              v{APP_VERSION}
            </button>
          </div>

          {!isBoardPage && (
            /* Hub-centré : la navbar n'expose plus la liste des modules (redondant
               avec le hub, et ne reflétait pas le gating feature-flag). Seul reste
               le raccourci « Tous les modules » vers le hub + un accès direct à
               « Mes équipes » (ressource transverse Daily/Roue/Capacité). */
            <nav className="flex items-center gap-1 ml-2">
              <Link
                href="/hub"
                title="Tous les modules"
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  pathname === '/hub'
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
                </svg>
              </Link>
              <Link
                href="/equipes"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith('/equipes')
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                Mes équipes
              </Link>
            </nav>
          )}

          <div className="ml-auto flex items-center gap-3">
            <Link
              href="/aide"
              title="Aide & Documentation"
              className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold transition-colors ${
                pathname.startsWith('/aide')
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-200 dark:hover:bg-gray-800'
              }`}
            >
              ?
            </Link>
            {user.isAdmin && (
              <Link
                href="/admin/flags"
                title="Feature flags (admin)"
                className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
                  pathname.startsWith('/admin')
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 4v6l7 4v6l4-2v-4l7-4V4" />
                </svg>
              </Link>
            )}
            <NotificationBell />
            <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">{user.name}</span>
            <Link href="/profile" title="Mon profil" className="hover:opacity-80 transition-opacity">
              <Avatar name={user.name} src={user.avatar} />
            </Link>
            <button
              onClick={() => { useNotificationsStore.getState().reset(); logout(); router.push('/login') }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
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
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="text-xs text-gray-500 dark:text-gray-500">
              © {new Date().getFullYear()} PIVOT · v{APP_VERSION}
            </span>
            <nav className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
              <Link href="/mentions-legales" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Mentions légales
              </Link>
              <Link href="/confidentialite" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Confidentialité
              </Link>
              <Link href="/cgu" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                CGU
              </Link>
            </nav>
          </div>
        </footer>
      )}

      {sessionExpired && <SessionExpiredModal />}
      <SessionCountdown />
    </div>
  )
}
