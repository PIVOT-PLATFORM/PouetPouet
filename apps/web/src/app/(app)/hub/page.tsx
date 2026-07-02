'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ModuleManifest } from '@pouetpouet/shared'
import { PIVOT_MODULES } from '@pouetpouet/shared'
import { useAuthStore } from '@/store/auth'
import { useFlags } from '@/store/flags'
import { api } from '@/lib/api'
import { MODULE_ICONS } from '@/lib/module-icons'
import { DOMAINS, MON_ESPACE } from '@/lib/hub-domains'
import { Star, ArrowRight, Compass, Presentation } from 'lucide-react'

interface RecentBoard   { id: string; name: string; updatedAt: string; coverImage: string | null }
interface RecentDaily   { id: string; name: string; status: string; endedAt: string | null; updatedAt: string }
interface RecentScrum   { id: string; name: string; code: string; updatedAt: string; team: { id: string; name: string } | null; _count: { tickets: number } }
interface RecentDraw    { id: string; teamName: string | null; results: string[]; count: number; createdAt: string }
interface RecentActivity { boards: RecentBoard[]; dailySessions: RecentDaily[]; scrumRooms: RecentScrum[]; wheelDraws: RecentDraw[] }

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `il y a ${d} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// Tuile outil compacte façon Google Drive : icône colorée, nom, étoile favori.
function ToolTile({ mod, isFav, onFav }: { mod: ModuleManifest; isFav: boolean; onFav: (id: string) => void }) {
  const Icon = MODULE_ICONS[mod.id]
  return (
    <div className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md hover:-translate-y-0.5 transition-all">
      <Link href={mod.nav[0].href} className="absolute inset-0 rounded-2xl" aria-label={mod.name} />
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${mod.color}1a`, color: mod.color }}>
          {Icon ? <Icon className="w-5 h-5" /> : <span className="text-xl">{mod.icon}</span>}
        </div>
        <button
          className={`relative z-10 p-1 rounded-lg transition-colors ${isFav ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 hover:text-amber-400'}`}
          onClick={(e) => { e.preventDefault(); onFav(mod.id) }}
          aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <Star className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} />
        </button>
      </div>
      <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mt-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{mod.name}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{mod.description}</p>
    </div>
  )
}

export default function HubPage() {
  const { user, toggleModuleFavorite } = useAuthStore()
  const [recent, setRecent] = useState<RecentActivity | null>(null)

  useEffect(() => {
    api.get<RecentActivity>('/api/hub/recent').then(setRecent).catch(() => {})
  }, [])

  const flags = useFlags()
  const favIds = user?.favoriteModules ?? []
  const isFav = (id: string) => favIds.includes(id)

  // Modules actifs (gating flag) indexés par id
  const moduleMap: Record<string, ModuleManifest> = Object.fromEntries(
    PIVOT_MODULES.filter((m) => flags[`module.${m.id}`] !== false).map((m) => [m.id, m]),
  )
  const favModules = favIds.map((id) => moduleMap[id]).filter(Boolean) as ModuleManifest[]

  const recentItems = recent
    ? [
        ...recent.boards.map((b) => ({ key: `b-${b.id}`, href: `/boards/${b.id}`, moduleId: 'pouetpouet', title: b.name, sub: timeAgo(b.updatedAt) as React.ReactNode, at: b.updatedAt })),
        ...recent.dailySessions.map((d) => ({ key: `d-${d.id}`, href: `/daily/${d.id}`, moduleId: 'daily', title: d.name, sub: (d.status === 'RUNNING' ? <span className="text-green-500">En cours</span> : timeAgo(d.endedAt ?? d.updatedAt)) as React.ReactNode, at: d.endedAt ?? d.updatedAt })),
        ...recent.scrumRooms.map((r) => ({ key: `s-${r.id}`, href: `/scrum/${r.id}`, moduleId: 'scrum', title: r.name, sub: `${r._count.tickets} ticket${r._count.tickets !== 1 ? 's' : ''}${r.team ? ` · ${r.team.name}` : ''} · ${timeAgo(r.updatedAt)}` as React.ReactNode, at: r.updatedAt })),
        ...recent.wheelDraws.map((w) => ({ key: `w-${w.id}`, href: '/wheel', moduleId: 'wheel', title: w.teamName ?? 'Tirage', sub: `${w.results.slice(0, 2).join(', ')}${w.results.length > 2 ? '…' : ''} · ${timeAgo(w.createdAt)}` as React.ReactNode, at: w.createdAt })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6)
    : []

  return (
    <div className="flex flex-col gap-10">

      {/* Hero */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Bonjour{user ? ` ${user.name.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">Vos outils, vos favoris et votre activité — au même endroit.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/present" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 transition-colors">
            <Presentation className="w-4 h-4" /> Présenter Pivot
          </Link>
          <Link href="/explorer" className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition-colors">
            <Compass className="w-4 h-4" /> Explorer les domaines
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Favoris */}
      {favModules.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Favoris</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {favModules.map((mod) => <ToolTile key={mod.id} mod={mod} isFav onFav={toggleModuleFavorite} />)}
          </div>
        </section>
      )}

      {/* Récents */}
      {recentItems.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Récent</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {recentItems.map((item) => {
              const Icon = MODULE_ICONS[item.moduleId]
              return (
                <Link key={item.key} href={item.href} className="group flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 text-gray-500 dark:text-gray-400">
                    {Icon && <Icon className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{item.title}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{item.sub}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Tous les outils — par domaine, façon Google Drive */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4">Tous les outils</h2>
        <div className="flex flex-col gap-8">
          {DOMAINS.map((domain) => {
            const mods = domain.moduleIds.map((id) => moduleMap[id]).filter(Boolean) as ModuleManifest[]
            if (mods.length === 0) return null
            return (
              <div key={domain.id}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: domain.color }} />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{domain.label}</h3>
                  <span className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {mods.map((mod) => <ToolTile key={mod.id} mod={mod} isFav={isFav(mod.id)} onFav={toggleModuleFavorite} />)}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Mon espace */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Mon espace</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {MON_ESPACE.map((item) => {
            const Icon = MODULE_ICONS[item.moduleId]
            return (
              <Link key={item.href} href={item.href} className="group flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3.5 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0 text-gray-500 dark:text-gray-400">
                  {Icon && <Icon className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{item.label}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{item.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Teaser Explorer */}
      <Link href="/explorer" className="group relative overflow-hidden rounded-2xl border border-primary-200 dark:border-primary-900/60 bg-gradient-to-br from-primary-50 to-secondary-50 dark:from-primary-950/40 dark:to-gray-900 p-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Découvrez ce qui arrive sur Pivot</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">7 domaines, des dizaines d'outils actuels et à venir. Dites-nous ce qui vous intéresse.</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-2 text-primary-700 dark:text-primary-300 font-semibold text-sm">
          Explorer <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </span>
      </Link>

    </div>
  )
}
