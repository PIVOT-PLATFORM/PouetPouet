'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PIVOT_MODULES } from '@pouetpouet/shared'
import { useAuthStore } from '@/store/auth'
import { useFlags } from '@/store/flags'
import { api } from '@/lib/api'
import { MODULE_ICONS } from '@/lib/module-icons'

interface HubStats {
  boards: number
  teams: number
  scrumRooms: number
  dailySessions: number
  capacityEvents: number
  wheelEvents: number
  testBooks: number
  parcourTemplates: number
  forms: number
}

interface RecentBoard   { id: string; name: string; updatedAt: string; coverImage: string | null }
interface RecentDaily   { id: string; name: string; status: string; endedAt: string | null; updatedAt: string }
interface RecentScrum   { id: string; name: string; code: string; updatedAt: string; team: { id: string; name: string } | null; _count: { tickets: number } }
interface RecentDraw    { id: string; teamName: string | null; results: string[]; count: number; createdAt: string }
interface RecentActivity { boards: RecentBoard[]; dailySessions: RecentDaily[]; scrumRooms: RecentScrum[]; wheelDraws: RecentDraw[] }

const STAT_CONFIG: { key: keyof HubStats; label: string; moduleId: string }[] = [
  { key: 'boards',           label: 'Boards',       moduleId: 'pouetpouet' },
  { key: 'teams',            label: 'Équipes',       moduleId: 'teams'      },
  { key: 'scrumRooms',       label: 'Salles Scrum',  moduleId: 'scrum'      },
  { key: 'dailySessions',    label: 'Dailys',        moduleId: 'daily'      },
  { key: 'capacityEvents',   label: 'Sprints',       moduleId: 'capacity'   },
  { key: 'wheelEvents',      label: 'Tirages',       moduleId: 'wheel'      },
  { key: 'testBooks',        label: 'Cahiers',       moduleId: 'testbooks'  },
  { key: 'parcourTemplates', label: 'Parcours',      moduleId: 'parcours'   },
  { key: 'forms',            label: 'Formulaires',   moduleId: 'forms'      },
]

// Regroupement par domaine — ordre = ordre d'affichage des cartes
const DOMAINS: { id: string; label: string; color: string; moduleIds: string[] }[] = [
  {
    id: 'collaboration',
    label: 'Collaboration',
    color: '#6366f1',
    moduleIds: ['pouetpouet', 'meetops', 'quiz', 'parcours', 'forms'],
  },
  {
    id: 'agile',
    label: 'Agile',
    color: '#f59e0b',
    moduleIds: ['scrum', 'daily', 'wheel', 'capacity'],
  },
  {
    id: 'pilotage',
    label: 'Pilotage',
    color: '#4f6ef7',
    moduleIds: ['roadmap', 'feedback'],
  },
  {
    id: 'outillage',
    label: 'Outillage',
    color: '#64748b',
    moduleIds: ['pdf', 'testbooks', 'signdoc'],
  },
]

// Liens user-centric (pas vue admin) — séparés des cartes modules
const MON_ESPACE: { label: string; desc: string; href: string; moduleId: string }[] = [
  { label: 'Mes parcours',          desc: 'Instances actives et historique',          href: '/parcours',           moduleId: 'parcours' },
  { label: 'Mes formulaires',       desc: 'Formulaires partagés avec vous',           href: '/forms',              moduleId: 'forms'    },
]

// Tous les modules à venir (plateforme cible)
const INCOMING: { name: string; domain: string }[] = [
  { name: 'OKR & Objectifs',                domain: 'Pilotage'       },
  { name: 'PPM / Portefeuille projets',     domain: 'Pilotage'       },
  { name: 'Tableaux de bord',               domain: 'Pilotage'       },
  { name: 'Gestion des risques',            domain: 'Pilotage'       },
  { name: 'Cartographie SI',                domain: 'Architecture'   },
  { name: 'Plan de reprise (PRA)',          domain: 'Architecture'   },
  { name: 'ADR — Décisions architecture',  domain: 'Architecture'   },
  { name: 'Compétences & Expertise',        domain: 'RH'             },
  { name: 'Formation',                      domain: 'RH'             },
  { name: 'Organigramme',                   domain: 'RH'             },
  { name: 'Recherche fédérée',              domain: 'Plateforme'     },
  { name: 'Assistant IA',                   domain: 'Plateforme'     },
  { name: 'Intégration SI',                 domain: 'Plateforme'     },
  { name: 'Mes PIP',                        domain: 'RH'             },
]

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

export default function HubPage() {
  const { user, toggleModuleFavorite } = useAuthStore()
  const [stats, setStats] = useState<HubStats | null>(null)
  const [recent, setRecent] = useState<RecentActivity | null>(null)
  const [showAllRecents, setShowAllRecents] = useState(false)

  useEffect(() => {
    api.get<HubStats>('/api/hub/stats').then(setStats).catch(() => {})
    api.get<RecentActivity>('/api/hub/recent').then(setRecent).catch(() => {})
  }, [])

  const favorites = new Set(user?.favoriteModules ?? [])
  const flags = useFlags()

  const moduleMap = Object.fromEntries(
    PIVOT_MODULES
      .filter((m) => flags[`module.${m.id}`] !== false)
      .map((m) => [m.id, m])
  )

  const recentItems = recent
    ? [
        ...recent.boards.map((b) => ({
          key: `b-${b.id}`, href: `/boards/${b.id}`, moduleId: 'pouetpouet', title: b.name,
          sub: timeAgo(b.updatedAt) as React.ReactNode, at: b.updatedAt,
        })),
        ...recent.dailySessions.map((d) => ({
          key: `d-${d.id}`, href: `/daily/${d.id}`, moduleId: 'daily', title: d.name,
          sub: (d.status === 'RUNNING'
            ? <span className="text-green-500">En cours</span>
            : timeAgo(d.endedAt ?? d.updatedAt)) as React.ReactNode,
          at: d.endedAt ?? d.updatedAt,
        })),
        ...recent.scrumRooms.map((r) => ({
          key: `s-${r.id}`, href: `/scrum/${r.id}`, moduleId: 'scrum', title: r.name,
          sub: `${r._count.tickets} ticket${r._count.tickets !== 1 ? 's' : ''}${r.team ? ` · ${r.team.name}` : ''} · ${timeAgo(r.updatedAt)}` as React.ReactNode,
          at: r.updatedAt,
        })),
        ...recent.wheelDraws.map((w) => ({
          key: `w-${w.id}`, href: '/wheel', moduleId: 'wheel', title: w.teamName ?? 'Tirage',
          sub: `${w.results.slice(0, 2).join(', ')}${w.results.length > 2 ? '…' : ''} · ${timeAgo(w.createdAt)}` as React.ReactNode,
          at: w.createdAt,
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    : []

  const visibleRecents = showAllRecents ? recentItems : recentItems.slice(0, 4)

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bonjour{user ? ` ${user.name.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Vos outils collaboratifs, au même endroit.
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-9 gap-3">
          {STAT_CONFIG.map(({ key, label, moduleId }) => {
            const Icon = MODULE_ICONS[moduleId]
            return (
              <div key={key} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 text-center">
                <div className="flex justify-center text-gray-400 dark:text-gray-500 mb-0.5">
                  {Icon && <Icon className="w-5 h-5" />}
                </div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-0.5">{stats[key]}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-500">{label}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Récent */}
      {recentItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Récent</h2>
            {recentItems.length > 4 && (
              <button onClick={() => setShowAllRecents((v) => !v)}
                className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors">
                {showAllRecents ? 'Réduire' : `Tout afficher (${recentItems.length})`}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {visibleRecents.map((item) => {
              const Icon = MODULE_ICONS[item.moduleId]
              return (
                <Link key={item.key} href={item.href}
                  className="group flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all">
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
        </div>
      )}

      {/* Domaines */}
      {DOMAINS.map((domain) => {
        const domainModules = domain.moduleIds
          .map((id) => moduleMap[id])
          .filter(Boolean)
        if (domainModules.length === 0) return null
        return (
          <div key={domain.id}>
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: domain.color }} />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{domain.label}</h2>
              <span className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {domainModules.map((mod) => {
                const isFav = favorites.has(mod.id)
                const ModIcon = MODULE_ICONS[mod.id]
                return (
                  <div key={mod.id}
                    className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 flex items-start gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <Link href={mod.nav[0].href} className="absolute inset-0 rounded-2xl" aria-label={mod.name} />
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${mod.color}1a`, color: mod.color }}>
                      {ModIcon ? <ModIcon className="w-6 h-6" /> : <span className="text-2xl">{mod.icon}</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{mod.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{mod.description}</p>
                      {mod.nav.length > 1 && (
                        <div className="relative flex flex-wrap gap-2 mt-2.5">
                          {mod.nav.map((link) => (
                            <Link key={link.href} href={link.href}
                              className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-950 dark:hover:text-primary-400 transition-colors">
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                    {user && (
                      <button
                        className={`relative z-10 shrink-0 p-1 rounded-lg transition-colors ${isFav ? 'text-amber-400 hover:text-amber-500' : 'text-gray-300 dark:text-gray-600 hover:text-amber-400 dark:hover:text-amber-400'}`}
                        onClick={(e) => { e.preventDefault(); toggleModuleFavorite(mod.id) }}
                        aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        title={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
                        <svg className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Mon espace — vues user (pas admin) */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Mon espace</h2>
          <span className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {MON_ESPACE.map((item) => {
            const Icon = MODULE_ICONS[item.moduleId]
            return (
              <Link key={item.href} href={item.href}
                className="group flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3.5 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all">
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
      </div>

      {/* Modules à venir */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0 bg-gray-300 dark:bg-gray-600" />
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Modules à venir</h2>
          <span className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INCOMING.map((m) => (
            <div key={m.name} aria-disabled="true"
              className="flex items-center gap-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-3 select-none">
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500 truncate">{m.name}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{m.domain}</p>
              </div>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5">
                À venir
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
