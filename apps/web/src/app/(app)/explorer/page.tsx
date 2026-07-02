'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ModuleManifest } from '@pouetpouet/shared'
import { PIVOT_MODULES } from '@pouetpouet/shared'
import { useFlags } from '@/store/flags'
import { api } from '@/lib/api'
import { MODULE_ICONS } from '@/lib/module-icons'
import { DOMAINS } from '@/lib/hub-domains'
import { ArrowRight, Sparkles, Check, Plus } from 'lucide-react'

export default function ExplorerPage() {
  const flags = useFlags()
  const [interests, setInterests] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    api.get<string[]>('/api/hub/interest').then((t) => setInterests(new Set(t))).catch(() => {})
  }, [])

  const moduleMap: Record<string, ModuleManifest> = Object.fromEntries(
    PIVOT_MODULES.filter((m) => flags[`module.${m.id}`] !== false).map((m) => [m.id, m]),
  )

  async function toggleInterest(tool: string) {
    setBusy(tool)
    // optimiste
    setInterests((prev) => {
      const next = new Set(prev)
      if (next.has(tool)) next.delete(tool); else next.add(tool)
      return next
    })
    try {
      await api.post('/api/hub/interest', { tool })
    } catch {
      // revert
      setInterests((prev) => {
        const next = new Set(prev)
        if (next.has(tool)) next.delete(tool); else next.add(tool)
        return next
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-10">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-primary-200/60 dark:border-primary-900/60 bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-primary-950/40 dark:via-gray-950 dark:to-gray-900 p-8 sm:p-10">
        <div className="relative max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-3">
            <Sparkles className="w-4 h-4" /> Explorateur Pivot
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Tous les domaines, tous les outils</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-3 leading-relaxed">
            Pivot s'organise en domaines. Découvrez les outils disponibles aujourd'hui et ceux à venir —
            et dites-nous lesquels vous intéressent : votre voix priorise la roadmap.
          </p>
        </div>
      </div>

      {/* Domaines */}
      {DOMAINS.map((domain) => {
        const current = domain.moduleIds.map((id) => moduleMap[id]).filter(Boolean) as ModuleManifest[]
        if (current.length === 0 && domain.upcoming.length === 0) return null
        return (
          <section key={domain.id}>
            <div className="flex items-center gap-3 mb-1">
              <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: domain.color }} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{domain.label}</h2>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 ml-6">{domain.description}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Outils actuels */}
              {current.map((mod) => {
                const Icon = MODULE_ICONS[mod.id]
                return (
                  <Link key={mod.id} href={mod.nav[0].href}
                    className="group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${mod.color}1a`, color: mod.color }}>
                        {Icon ? <Icon className="w-5 h-5" /> : <span className="text-xl">{mod.icon}</span>}
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-full px-2 py-0.5">Disponible</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mt-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{mod.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{mod.description}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 mt-3">
                      Ouvrir <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </Link>
                )
              })}

              {/* Outils à venir — clic = j'exprime mon intérêt */}
              {domain.upcoming.map((name) => {
                const interested = interests.has(name)
                return (
                  <div key={name}
                    className={`relative rounded-2xl border border-dashed p-5 transition-all ${interested ? 'border-primary-400 dark:border-primary-600 bg-primary-50/50 dark:bg-primary-950/30' : 'border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40'}`}>
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gray-200/70 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-200/70 dark:bg-gray-800 rounded-full px-2 py-0.5">À venir</span>
                    </div>
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 mt-3">{name}</h3>
                    <button
                      onClick={() => toggleInterest(name)}
                      disabled={busy === name}
                      className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-60 ${interested ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:text-primary-600'}`}
                    >
                      {interested ? <><Check className="w-3.5 h-3.5" /> Ça m'intéresse</> : <><Plus className="w-3.5 h-3.5" /> M'intéresse</>}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      <p className="text-center text-xs text-gray-400 dark:text-gray-600">
        Votre intérêt est enregistré de façon anonyme et sert uniquement à prioriser la feuille de route.
      </p>
    </div>
  )
}
