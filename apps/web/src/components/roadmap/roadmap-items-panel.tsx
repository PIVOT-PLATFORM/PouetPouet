'use client'

import { useState } from 'react'
import type { RoadmapItem } from '@/hooks/useRoadmap'
import { CATEGORIES, RISKS } from './roadmap-constants'
import { diffDays } from '@/lib/roadmap-timeline'

interface Props {
  items: RoadmapItem[] // ordonnés
  totalDays: number
  canEdit: boolean
  onEdit: (item: RoadmapItem) => void
  onDuplicate: (item: RoadmapItem) => void
  onDelete: (item: RoadmapItem) => void
  onReorder: (orderedIds: string[]) => void
}

export function RoadmapItemsPanel({ items, totalDays, canEdit, onEdit, onDuplicate, onDelete, onReorder }: Props) {
  const [query, setQuery] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const filtered = items.filter((i) => !query || i.name.toLowerCase().includes(query.toLowerCase()) || (i.biz ?? '').toLowerCase().includes(query.toLowerCase()))

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return }
    const ids = items.map((i) => i.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    onReorder(ids)
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un item…"
          className="w-64 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <span className="text-sm text-gray-400 font-mono">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400">
          <span className="text-3xl opacity-30">📝</span>
          <p className="text-sm font-medium">Aucun item</p>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', alignContent: 'start' }}>
          {filtered.map((item) => {
            const days = diffDays(item.startDate, item.endDate)
            const pct = Math.min(100, totalDays > 0 ? Math.round((days / totalDays) * 100) : 0)
            const cats = item.categories.length ? item.categories : (['dev'] as const)
            const catColor = CATEGORIES[cats[0]].color
            return (
              <div
                key={item.id}
                draggable={canEdit && !query}
                onDragStart={() => setDragId(item.id)}
                onDragEnd={() => { setDragId(null); setOverId(null) }}
                onDragOver={(e) => { e.preventDefault(); setOverId(item.id) }}
                onDragLeave={() => setOverId((o) => (o === item.id ? null : o))}
                onDrop={(e) => { e.preventDefault(); handleDrop(item.id) }}
                className={`bg-white dark:bg-gray-900 border rounded-2xl p-4 flex flex-col gap-2.5 transition-all ${dragId === item.id ? 'opacity-40 border-dashed' : overId === item.id ? 'border-primary-400 ring-2 ring-primary-100 dark:ring-primary-900' : 'border-gray-200 dark:border-gray-700 hover:shadow-md'}`}
              >
                <div className="flex items-center gap-2">
                  {canEdit && !query && <span className="text-gray-300 cursor-grab select-none leading-none" title="Glisser pour réordonner">⠿</span>}
                  <span className="w-2.5 h-2.5 rounded shrink-0" style={{ background: catColor }} />
                  <span className="text-sm font-bold text-gray-900 dark:text-white flex-1 truncate">{item.name}</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ background: RISKS[item.risk].color + '1f', color: RISKS[item.risk].color }}>{RISKS[item.risk].label}</span>
                  {cats.map((k) => (
                    <span key={k} className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: CATEGORIES[k].color + '22', color: CATEGORIES[k].color }}>{CATEGORIES[k].label}</span>
                  ))}
                  {item.prio === 'must' && <span className="text-amber-400 text-sm" title="Must">★</span>}
                </div>

                {item.startDate === item.endDate
                  ? <div className="font-mono text-[11px] text-gray-400">⬦ Jalon · {item.startDate}</div>
                  : <div className="font-mono text-[11px] text-gray-400">{item.startDate} → {item.endDate} <span className="text-gray-300">· {days} j</span></div>
                }

                <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: catColor + '88' }} />
                </div>

                {item.biz && <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{item.biz}</p>}

                {item.deps.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.deps.map((did) => {
                      const dep = items.find((x) => x.id === did)
                      return dep ? <span key={did} className="text-[10px] font-mono bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded px-1.5 py-0.5">→ {dep.name}</span> : null
                    })}
                  </div>
                )}

                {canEdit && (
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => onEdit(item)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">✎ Modifier</button>
                    <button onClick={() => onDuplicate(item)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">⧉ Dupliquer</button>
                    <button onClick={() => onDelete(item)} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 ml-auto">Supprimer</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
