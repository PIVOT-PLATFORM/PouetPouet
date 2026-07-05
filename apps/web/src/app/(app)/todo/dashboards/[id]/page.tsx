'use client'

import { ChevronLeft, ListChecks, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTodoDashboard } from '@/hooks/useTodoDashboards'
import { useTodoLists } from '@/hooks/useTodo'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { ModuleShareModal } from '@/components/share/module-share-modal'

const LIST_COLORS = ['#f97316', '#4f6ef7', '#2a9d5c', '#b04a2e', '#e11d48', '#0d9488', '#7c5cff']

function frDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function TodoDashboardDetailPage() {
  useFlagGuard('module.todo')
  const { id } = useParams<{ id: string }>()
  const { dashboard, stats, isLoading, accessDenied, updateMeta, attachList, detachList } = useTodoDashboard(id)
  const { lists: myLists } = useTodoLists({ mine: true })

  const [showShare, setShowShare] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [filterListId, setFilterListId] = useState<string | null>(null)

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (accessDenied || !dashboard) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Tableau de bord introuvable ou accès refusé.</p>
        <Link href="/todo/dashboards" className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"><ChevronLeft size={16} />Retour aux tableaux de bord</Link>
      </div>
    )
  }

  const canEdit = dashboard.role === 'OWNER' || dashboard.role === 'EDITOR'
  const isOwner = dashboard.role === 'OWNER'

  const listColor = new Map(dashboard.lists.map((l, i) => [l.id, LIST_COLORS[i % LIST_COLORS.length]]))
  const byListStats = stats ? new Map(stats.byList.map((l) => [l.id, l])) : new Map()
  const visibleLists = filterListId ? dashboard.lists.filter((l) => l.id === filterListId) : dashboard.lists

  const attachableLists = myLists.filter((l) => (l.role === 'OWNER' || l.role === 'EDITOR') && l.dashboardId !== dashboard.id)

  async function handleAttach(listId: string) {
    await attachList(listId)
    setShowAttach(false)
  }
  async function handleDetach(listId: string, name: string) {
    if (confirm(`Détacher « ${name} » de ce tableau de bord ? La liste ne sera pas supprimée.`)) await detachList(listId)
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/todo/dashboards" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={16} />Tableaux de bord</Link>

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {canEdit ? (
            <input
              defaultValue={dashboard.name}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== dashboard.name) updateMeta({ name: v }) }}
              className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-orange-400 rounded-lg px-2 py-1 -ml-2 focus:outline-none min-w-[200px]"
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{dashboard.name}</h1>
          )}
          {!isOwner && <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">{dashboard.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && <button onClick={() => setShowAttach(true)} className="rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2.5 active:scale-95 transition-all shadow-sm">+ Rattacher une liste</button>}
          {isOwner && <button onClick={() => setShowShare(true)} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Partager</button>}
        </div>
      </div>

      {/* Listes rattachées — légende cliquable / filtre */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 shrink-0">Listes</span>
        {dashboard.lists.length === 0 && <span className="text-xs text-gray-400">Aucune liste rattachée pour l&apos;instant.</span>}
        {dashboard.lists.map((l) => (
          <div key={l.id} className="group relative">
            <button
              onClick={() => setFilterListId(filterListId === l.id ? null : l.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${filterListId === l.id ? 'ring-2 ring-offset-1 ring-gray-300' : 'opacity-80 hover:opacity-100'}`}
              style={{ borderColor: listColor.get(l.id), color: listColor.get(l.id) }}
            >
              <span className="w-2 h-2 rounded-sm" style={{ background: listColor.get(l.id) }} />
              {l.name} <span className="text-gray-400 font-mono">({l.doneCount}/{l.itemCount})</span>
            </button>
            {canEdit && (
              <button onClick={() => handleDetach(l.id, l.name)} title="Détacher"
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 text-[10px] leading-4 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600">×</button>
            )}
          </div>
        ))}
        {filterListId && (
          <button onClick={() => setFilterListId(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">× Voir tout</button>
        )}
      </div>

      {dashboard.lists.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
          <ListChecks className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium">Rattachez une liste pour voir les statistiques consolidées</p>
        </div>
      ) : stats && (
        <>
          {/* Tuiles de stats globales */}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Complétion globale</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.completionPercent}%</p>
              <p className="text-xs text-gray-400 mt-0.5">{stats.totalDone}/{stats.totalItems} tâches</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">En retard</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalOverdue}</p>
            </div>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Non faites par priorité</p>
              <div className="flex gap-2 text-xs text-gray-600 dark:text-gray-300 flex-wrap">
                <span>Haute <b>{stats.byPriority.HIGH}</b></span>
                <span>Moy. <b>{stats.byPriority.MEDIUM}</b></span>
                <span>Basse <b>{stats.byPriority.LOW}</b></span>
                <span>— <b>{stats.byPriority.NONE}</b></span>
              </div>
            </div>
          </div>

          {/* Complétion par liste */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Complétion par liste</span>
            {visibleLists.map((l) => {
              const s = byListStats.get(l.id)
              if (!s) return null
              return (
                <div key={l.id} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-40 truncate shrink-0">{l.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.completionPercent}%`, background: listColor.get(l.id) }} />
                  </div>
                  <span className="text-xs text-gray-400 font-mono w-24 shrink-0 text-right">{s.doneCount}/{s.itemCount} · {s.completionPercent}%</span>
                  {s.overdueCount > 0 && <span className="text-[11px] text-red-500 shrink-0">{s.overdueCount} en retard</span>}
                </div>
              )
            })}
          </div>

          {/* Récemment terminé */}
          {stats.recentlyCompleted.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Récemment terminé</span>
              <div className="flex flex-col gap-1.5">
                {stats.recentlyCompleted.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-3 py-2">
                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                    <span className="flex-1 truncate">{i.title}</span>
                    <span className="text-xs text-gray-400 shrink-0">{i.listName}</span>
                    <span className="text-xs text-gray-400 font-mono shrink-0">{frDateTime(i.completedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showAttach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowAttach(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rattacher une liste</h2>
            </div>
            <div className="p-4 overflow-y-auto flex flex-col gap-1.5">
              {attachableLists.length === 0 ? (
                <p className="text-sm text-gray-400 px-2 py-4 text-center">Aucune liste disponible — créez-en une d&apos;abord, ou vérifiez que vous en êtes propriétaire/éditeur.</p>
              ) : (
                attachableLists.map((l) => (
                  <button key={l.id} onClick={() => handleAttach(l.id)} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-left hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{l.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{l.doneCount}/{l.itemCount} tâches{l.dashboardId && l.dashboardId !== dashboard.id ? ' · déjà dans un autre tableau de bord' : ''}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={() => setShowAttach(false)} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {showShare && (
        <ModuleShareModal module="tododashboard" resourceId={dashboard.id} resourceName={dashboard.name} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
