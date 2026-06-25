'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useRoadmap, type RoadmapScale, type RoadmapItem, type ItemInput, type Category, type Risk, type Prio } from '@/hooks/useRoadmap'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { ModuleShareModal } from '@/components/share/module-share-modal'
import { RoadmapTimeline } from '@/components/roadmap/roadmap-timeline'
import { RoadmapItemsPanel } from '@/components/roadmap/roadmap-items-panel'
import { RoadmapItemModal } from '@/components/roadmap/roadmap-item-modal'
import { exportRoadmapPDF } from '@/components/roadmap/roadmap-pdf'
import { CATEGORIES, RISKS, CATEGORY_KEYS, RISK_KEYS } from '@/components/roadmap/roadmap-constants'
import { SCALE_LABELS, diffDays } from '@/lib/roadmap-timeline'

type Tab = 'roadmap' | 'items'
const SCALES: RoadmapScale[] = ['week', 'month', 'quarter', 'semester', 'year']

export default function RoadmapEditorPage() {
  useFlagGuard('module.roadmap')
  const { id } = useParams<{ id: string }>()
  const { roadmap, isLoading, accessDenied, updateMeta, createItem, updateItem, deleteItem, reorderItems } = useRoadmap(id)

  const [tab, setTab] = useState<Tab>('roadmap')
  const [showDeps, setShowDeps] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [editing, setEditing] = useState<RoadmapItem | null | undefined>(undefined)

  const [filterCat, setFilterCat] = useState<Category | null>(null)
  const [filterRisk, setFilterRisk] = useState<Risk | null>(null)
  const [filterPrio, setFilterPrio] = useState<Prio | null>(null)

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (accessDenied || !roadmap) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Roadmap introuvable ou accès refusé.</p>
        <Link href="/roadmap" className="text-sm font-medium text-primary-600 hover:text-primary-700">← Retour aux roadmaps</Link>
      </div>
    )
  }

  const canEdit = roadmap.role === 'OWNER' || roadmap.role === 'EDITOR'
  const isOwner = roadmap.role === 'OWNER'
  const orderedItems = [...roadmap.items].sort((a, b) => a.order - b.order)
  const filteredItems = orderedItems.filter((item) => {
    if (filterCat && !item.categories.includes(filterCat)) return false
    if (filterRisk && item.risk !== filterRisk) return false
    if (filterPrio && item.prio !== filterPrio) return false
    return true
  })
  const totalDays = diffDays(roadmap.startDate, roadmap.endDate)
  const hasFilters = !!(filterCat || filterRisk || filterPrio)

  async function handleSaveItem(input: ItemInput) {
    if (editing) await updateItem(editing.id, input)
    else await createItem(input)
  }
  async function handleDuplicate(item: RoadmapItem) {
    await createItem({
      name: `${item.name} (copie)`, startDate: item.startDate, endDate: item.endDate,
      biz: item.biz ?? undefined, risk: item.risk, prio: item.prio, categories: item.categories, deps: [],
    })
  }
  async function handleDeleteItem(item: RoadmapItem) {
    if (confirm(`Supprimer « ${item.name} » ?`)) await deleteItem(item.id)
  }

  function handleItemUpdate(itemId: string, patch: { startDate: string; endDate: string }) {
    updateItem(itemId, patch)
  }

  async function exportPDF() {
    if (!roadmap) return
    await exportRoadmapPDF(roadmap, orderedItems)
  }

  function exportJSON() {
    const data = {
      name: roadmap!.name, startDate: roadmap!.startDate, endDate: roadmap!.endDate, scale: roadmap!.scale,
      items: orderedItems.map(({ id: _id, roadmapId: _r, createdAt: _c, updatedAt: _u, order: _o, ...rest }) => rest),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${roadmap!.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/roadmap" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>Roadmap</Link>

      {/* En-tête */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {canEdit ? (
            <input
              defaultValue={roadmap.name}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== roadmap.name) updateMeta({ name: v }) }}
              className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-primary-400 rounded-lg px-2 py-1 -ml-2 focus:outline-none min-w-[200px]"
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{roadmap.name}</h1>
          )}
          {!isOwner && <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">{roadmap.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}</span>}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
            <button onClick={() => setTab('roadmap')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'roadmap' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📅 Roadmap</button>
            <button onClick={() => setTab('items')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'items' ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>☰ Items</button>
          </div>
          {canEdit && <button onClick={() => setEditing(null)} className="flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2.5 active:scale-95 transition-all shadow-sm"><Plus className="w-4 h-4" />Item</button>}
          <button onClick={exportPDF} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">↓ PDF</button>
          <button onClick={exportJSON} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">↓ JSON</button>
          {isOwner && <button onClick={() => setShowShare(true)} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Partager</button>}
        </div>
      </div>

      {/* Contrôles roadmap */}
      {tab === 'roadmap' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs font-medium">Du</span>
              <input type="date" value={roadmap.startDate} disabled={!canEdit} onChange={(e) => updateMeta({ startDate: e.target.value })}
                className="font-mono text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1 disabled:opacity-60" />
              <span className="text-gray-400 text-xs font-medium">au</span>
              <input type="date" value={roadmap.endDate} disabled={!canEdit} onChange={(e) => updateMeta({ endDate: e.target.value })}
                className="font-mono text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1 disabled:opacity-60" />
            </div>
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 gap-0.5">
              {SCALES.map((s) => (
                <button key={s} onClick={() => canEdit && updateMeta({ scale: s })} disabled={!canEdit}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${roadmap.scale === s ? 'bg-white dark:bg-gray-700 text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 disabled:hover:text-gray-500'}`}>
                  {SCALE_LABELS[s]}
                </button>
              ))}
            </div>
            <button onClick={() => setShowDeps((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${showDeps ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              → Dépendances
            </button>
          </div>

          {/* Filtres */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 shrink-0">Filtres</span>
            {CATEGORY_KEYS.map((c) => (
              <button key={c} onClick={() => setFilterCat(filterCat === c ? null : c)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${filterCat === c ? 'opacity-100 ring-2 ring-offset-1 ring-gray-300' : 'opacity-45 hover:opacity-80'}`}
                style={{ background: CATEGORIES[c].color, color: CATEGORIES[c].text }}>
                {CATEGORIES[c].label}
              </button>
            ))}
            {RISK_KEYS.map((r) => (
              <button key={r} onClick={() => setFilterRisk(filterRisk === r ? null : r)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${filterRisk === r ? 'font-bold' : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600'}`}
                style={filterRisk === r ? { color: RISKS[r].color, borderColor: RISKS[r].color, background: RISKS[r].color + '18' } : {}}>
                ● {RISKS[r].label}
              </button>
            ))}
            <button onClick={() => setFilterPrio(filterPrio === 'must' ? null : 'must')}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${filterPrio === 'must' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 font-bold' : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600'}`}>
              ★ Must
            </button>
            {hasFilters && (
              <>
                <button onClick={() => { setFilterCat(null); setFilterRisk(null); setFilterPrio(null) }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  × Effacer
                </button>
                <span className="font-mono text-[10px] text-gray-400">{filteredItems.length}/{orderedItems.length}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Contenu */}
      {tab === 'roadmap' ? (
        filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
            <span className="text-3xl opacity-30">📅</span>
            <p className="text-sm font-medium">{hasFilters ? 'Aucun item ne correspond aux filtres' : 'Aucun item sur la roadmap'}</p>
            {!hasFilters && canEdit && <button onClick={() => setEditing(null)} className="text-sm font-medium text-primary-600 hover:text-primary-700">Ajouter un item</button>}
          </div>
        ) : (
          <RoadmapTimeline
            startDate={roadmap.startDate}
            endDate={roadmap.endDate}
            scale={roadmap.scale}
            items={filteredItems}
            showDeps={showDeps}
            onItemClick={(item) => canEdit ? setEditing(item) : undefined}
            onItemUpdate={canEdit ? handleItemUpdate : undefined}
          />
        )
      ) : (
        <RoadmapItemsPanel
          items={filteredItems}
          totalDays={totalDays}
          canEdit={canEdit}
          onEdit={(item) => setEditing(item)}
          onDuplicate={handleDuplicate}
          onDelete={handleDeleteItem}
          onReorder={reorderItems}
        />
      )}

      {/* Légende */}
      <div className="flex items-center gap-4 text-[11px] text-gray-400 font-mono flex-wrap">
        <span className="font-semibold text-gray-500">Domaine :</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#3b6fd4' }} />Infra</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#2a9d5c' }} />Dev</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#b04a2e' }} />Cyber</span>
        <span className="w-px h-3 bg-gray-200" />
        <span className="font-semibold text-gray-500">Risque :</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#22c78a' }} />Faible</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />Moyen</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />Élevé</span>
        <span className="w-px h-3 bg-gray-200" />
        <span className="flex items-center gap-1 text-amber-500">★ Must</span>
        <span className="w-px h-3 bg-gray-200" />
        <span>⬦ Jalon</span>
      </div>

      {editing !== undefined && (
        <RoadmapItemModal
          item={editing}
          allItems={orderedItems}
          defaultStart={roadmap.startDate}
          defaultEnd={roadmap.endDate}
          onSave={handleSaveItem}
          onDelete={editing ? async () => { await deleteItem(editing.id); setEditing(undefined) } : undefined}
          onDuplicate={editing ? async () => { await handleDuplicate(editing); setEditing(undefined) } : undefined}
          onClose={() => setEditing(undefined)}
        />
      )}

      {showShare && (
        <ModuleShareModal module="roadmap" resourceId={roadmap.id} resourceName={roadmap.name} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
