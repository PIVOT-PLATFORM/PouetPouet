'use client'

import Link from 'next/link'
import { FORGE_MODULES } from '@pouetpouet/shared'
import { useAuthStore } from '@/store/auth'

// FORGE F1 — hub launcher : les tuiles sont rendues depuis les manifests des
// modules. Activer un module dans le registre l'ajoute ici automatiquement.
export default function HubPage() {
  const { user } = useAuthStore()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bonjour{user ? ` ${user.name.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Vos outils collaboratifs, au même endroit.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {FORGE_MODULES.map((mod) => (
          <div
            key={mod.id}
            className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex items-start gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all"
          >
            {/* Lien principal étiré sur toute la tuile (pas de <a> imbriqués) */}
            <Link href={mod.nav[0].href} className="absolute inset-0 rounded-2xl" aria-label={mod.name} />
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
              style={{ background: `${mod.color}1a` }}
            >
              {mod.icon}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {mod.name}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{mod.description}</p>
              {mod.nav.length > 1 && (
                <div className="relative flex flex-wrap gap-2 mt-2.5">
                  {mod.nav.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-400 transition-colors"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
