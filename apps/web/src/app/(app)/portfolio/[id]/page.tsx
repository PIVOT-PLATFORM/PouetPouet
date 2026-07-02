'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { usePortfolio } from '@/hooks/usePortfolio'
import { useRoadmaps } from '@/hooks/useRoadmap'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { ModuleShareModal } from '@/components/share/module-share-modal'
import { RoadmapTimeline } from '@/components/roadmap/roadmap-timeline'
import { frDate } from '@/lib/roadmap-timeline'

const ROADMAP_COLORS = ['#4f6ef7', '#2a9d5c', '#b04a2e', '#e11d48', '#0d9488', '#7c5cff', '#f59e0b']

export default function PortfolioDetailPage() {
  useFlagGuard('module.portfolio')
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { portfolio, roadmapDetails, isLoading, accessDenied, updateMeta, attachRoadmap, detachRoadmap } = usePortfolio(id)
  const { roadmaps: myRoadmaps } = useRoadmaps()

  const [showShare, setShowShare] = useState(false)
  const [showAttach, setShowAttach] = useState(false)
  const [filterRoadmapId, setFilterRoadmapId] = useState<string | null>(null)

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (accessDenied || !portfolio) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Portefeuille introuvable ou accès refusé.</p>
        <Link href="/portfolio" className="text-sm font-medium text-primary-600 hover:text-primary-700">← Retour aux portefeuilles</Link>
      </div>
    )
  }

  const canEdit = portfolio.role === 'OWNER' || portfolio.role === 'EDITOR'
  const isOwner = portfolio.role === 'OWNER'

  // Couleur stable par roadmap (index dans la liste triée par id).
  const roadmapColor = new Map(portfolio.roadmaps.map((r, i) => [r.id, ROADMAP_COLORS[i % ROADMAP_COLORS.length]]))

  // Fusion des items de toutes les roadmaps rattachées pour la timeline consolidée.
  const visibleRoadmaps = filterRoadmapId ? roadmapDetails.filter((r) => r.id === filterRoadmapId) : roadmapDetails
  const allItems = visibleRoadmaps.flatMap((r) => r.items)
  const rangeStart = visibleRoadmaps.length ? visibleRoadmaps.map((r) => r.startDate).sort()[0] : '2026-01-01'
  const rangeEnd = visibleRoadmaps.length ? visibleRoadmaps.map((r) => r.endDate).sort().slice(-1)[0] : '2026-12-31'

  // Roadmaps que l'utilisateur peut rattacher : les siennes/éditables, pas déjà dans ce portefeuille.
  const attachableRoadmaps = myRoadmaps.filter((r) => (r.role === 'OWNER' || r.role === 'EDITOR') && r.portfolioId !== portfolio.id)

  async function handleAttach(roadmapId: string) {
    await attachRoadmap(roadmapId)
    setShowAttach(false)
  }
  async function handleDetach(roadmapId: string, name: string) {
    if (confirm(`Détacher « ${name} » de ce portefeuille ? La roadmap ne sera pas supprimée.`)) await detachRoadmap(roadmapId)
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/portfolio" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Portefeuille</Link>

      {/* En-tête */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {canEdit ? (
            <input
              defaultValue={portfolio.name}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== portfolio.name) updateMeta({ name: v }) }}
              className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-primary-400 rounded-lg px-2 py-1 -ml-2 focus:outline-none min-w-[200px]"
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{portfolio.name}</h1>
          )}
          {!isOwner && <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">{portfolio.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && <button onClick={() => setShowAttach(true)} className="rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 active:scale-95 transition-all shadow-sm">+ Rattacher une roadmap</button>}
          {isOwner && <button onClick={() => setShowShare(true)} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Partager</button>}
        </div>
      </div>

      {/* Roadmaps rattachées — légende cliquable / filtre */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 shrink-0">Roadmaps</span>
        {portfolio.roadmaps.length === 0 && <span className="text-xs text-gray-400">Aucune roadmap rattachée pour l'instant.</span>}
        {portfolio.roadmaps.map((r) => (
          <div key={r.id} className="group relative">
            <button
              onClick={() => setFilterRoadmapId(filterRoadmapId === r.id ? null : r.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${filterRoadmapId === r.id ? 'ring-2 ring-offset-1 ring-gray-300' : 'opacity-80 hover:opacity-100'}`}
              style={{ borderColor: roadmapColor.get(r.id), color: roadmapColor.get(r.id) }}
            >
              <span className="w-2 h-2 rounded-sm" style={{ background: roadmapColor.get(r.id) }} />
              {r.name} <span className="text-gray-400 font-mono">({r.itemCount})</span>
            </button>
            {canEdit && (
              <button onClick={() => handleDetach(r.id, r.name)} title="Détacher"
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 text-[10px] leading-4 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 hover:text-red-600">×</button>
            )}
          </div>
        ))}
        {filterRoadmapId && (
          <button onClick={() => setFilterRoadmapId(null)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">× Voir tout</button>
        )}
      </div>

      {/* Timeline consolidée (lecture — éditer depuis la roadmap d'origine) */}
      {allItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
          <span className="text-3xl opacity-30">🗂️</span>
          <p className="text-sm font-medium">{portfolio.roadmaps.length === 0 ? 'Rattachez une roadmap pour voir la vue consolidée' : 'Aucun item dans les roadmaps rattachées'}</p>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-gray-400">Vue consolidée en lecture — cliquez un item pour l'éditer dans sa roadmap d'origine.</p>
          <RoadmapTimeline
            startDate={rangeStart}
            endDate={rangeEnd}
            scale="quarter"
            items={allItems}
            showDeps={false}
            onItemClick={(item) => router.push(`/roadmap/${item.roadmapId}`)}
          />
        </>
      )}

      {showAttach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowAttach(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rattacher une roadmap</h2>
            </div>
            <div className="p-4 overflow-y-auto flex flex-col gap-1.5">
              {attachableRoadmaps.length === 0 ? (
                <p className="text-sm text-gray-400 px-2 py-4 text-center">Aucune roadmap disponible — créez-en une d'abord, ou vérifiez que vous en êtes propriétaire/éditeur.</p>
              ) : (
                attachableRoadmaps.map((r) => (
                  <button key={r.id} onClick={() => handleAttach(r.id)} className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-left hover:border-primary-300 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{r.name}</p>
                      <p className="text-[11px] text-gray-400 font-mono">{frDate(r.startDate)} → {frDate(r.endDate)}{r.portfolioId && r.portfolioId !== portfolio.id ? ' · déjà dans un autre portefeuille' : ''}</p>
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
        <ModuleShareModal module="portfolio" resourceId={portfolio.id} resourceName={portfolio.name} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
