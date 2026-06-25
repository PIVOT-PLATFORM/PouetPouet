'use client'

import { useState } from 'react'
import type { RoadmapItem, ItemInput, Category, Risk, Prio } from '@/hooks/useRoadmap'
import { CATEGORIES, CATEGORY_KEYS, RISKS, RISK_KEYS } from './roadmap-constants'

interface Props {
  item: RoadmapItem | null // null = création
  allItems: RoadmapItem[] // pour la liste de dépendances
  defaultStart: string
  defaultEnd: string
  onSave: (input: ItemInput) => Promise<void>
  onDelete?: () => Promise<void>
  onDuplicate?: () => Promise<void>
  onClose: () => void
}

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400'

export function RoadmapItemModal({ item, allItems, defaultStart, defaultEnd, onSave, onDelete, onDuplicate, onClose }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [startDate, setStartDate] = useState(item?.startDate ?? defaultStart)
  const [endDate, setEndDate] = useState(item?.endDate ?? defaultEnd)
  const [biz, setBiz] = useState(item?.biz ?? '')
  const [risk, setRisk] = useState<Risk>(item?.risk ?? 'med')
  const [prio, setPrio] = useState<Prio>(item?.prio ?? 'should')
  const [categories, setCategories] = useState<Category[]>(item?.categories?.length ? item.categories : ['dev'])
  const [deps, setDeps] = useState<string[]>(item?.deps ?? [])
  const [depQuery, setDepQuery] = useState('')
  const [isMilestone, setIsMilestone] = useState(() => !!(item && item.startDate === item.endDate))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const others = allItems.filter((i) => i.id !== item?.id)
  const filteredOthers = others.filter((i) => !depQuery || i.name.toLowerCase().includes(depQuery.toLowerCase()))

  function handleStartChange(v: string) {
    setStartDate(v)
    if (isMilestone) setEndDate(v)
  }
  function handleToggleMilestone(v: boolean) {
    setIsMilestone(v)
    if (v) setEndDate(startDate)
  }

  function toggleCategory(c: Category) {
    setCategories((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])
  }
  function toggleDep(id: string) {
    setDeps((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  async function handleSave() {
    setError(null)
    if (!name.trim()) { setError('Le nom est obligatoire.'); return }
    if (!startDate || !endDate) { setError('Les dates sont obligatoires.'); return }
    if (startDate > endDate) { setError('Le début doit précéder la fin.'); return }
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        startDate,
        endDate,
        biz: biz.trim() || undefined,
        risk,
        prio,
        categories: categories.length ? categories : ['dev'],
        deps,
      })
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 shrink-0 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{item ? "Modifier l'item" : 'Nouvel item'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Nom *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Migration infra, Lancement v2…" className={inputCls} autoFocus />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Début *</label>
                <input type="date" value={startDate} onChange={(e) => handleStartChange(e.target.value)} className={inputCls} />
              </div>
              {!isMilestone && (
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Fin *</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
                </div>
              )}
            </div>
            <button type="button" onClick={() => handleToggleMilestone(!isMilestone)}
              className={`self-start rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${isMilestone ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 hover:text-gray-500'}`}>
              ⬦ {isMilestone ? 'Jalon (date unique)' : 'Marquer comme jalon'}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Valeur business</label>
            <textarea value={biz} onChange={(e) => setBiz(e.target.value)} placeholder="Décrivez l'impact business…" rows={3} className={`${inputCls} resize-y`} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Risque</label>
            <div className="flex gap-2">
              {RISK_KEYS.map((r) => (
                <button key={r} type="button" onClick={() => setRisk(r)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${risk === r ? 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}>
                  <span style={{ color: RISKS[r].color }}>●</span> {RISKS[r].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Priorité</label>
            <div className="flex gap-2">
              {(['should', 'must'] as Prio[]).map((p) => (
                <button key={p} type="button" onClick={() => setPrio(p)}
                  className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${prio === p ? (p === 'must' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'border-primary-500 bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300') : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300'}`}>
                  {p === 'must' ? '★ Must' : 'Should'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Catégorie <span className="text-gray-300 normal-case font-normal">(multi)</span></label>
            <div className="flex gap-2">
              {CATEGORY_KEYS.map((c) => {
                const on = categories.includes(c)
                return (
                  <button key={c} type="button" onClick={() => toggleCategory(c)}
                    className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${on ? 'ring-2 ring-offset-1 ring-gray-400' : 'opacity-60 hover:opacity-100'}`}
                    style={{ background: CATEGORIES[c].color, color: CATEGORIES[c].text }}>
                    {CATEGORIES[c].label}
                  </button>
                )
              })}
            </div>
          </div>

          {others.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dépendances <span className="text-gray-300 normal-case font-normal">(démarre après…)</span></label>
              <input value={depQuery} onChange={(e) => setDepQuery(e.target.value)} placeholder="Rechercher un item…" className={`${inputCls} mb-1`} />
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {filteredOthers.length === 0 && <p className="text-xs text-gray-400 font-mono px-1 py-1.5">Aucun résultat</p>}
                {filteredOthers.map((o) => {
                  const on = deps.includes(o.id)
                  const catColor = CATEGORIES[o.categories[0] ?? 'dev']?.color ?? '#2a9d5c'
                  return (
                    <button key={o.id} type="button" onClick={() => toggleDep(o.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors text-left ${on ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40' : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'}`}>
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: catColor }} />
                      <span className="flex-1 truncate text-gray-700 dark:text-gray-200">{o.name}</span>
                      <span className="font-mono text-[10px] text-gray-400">{o.startDate}</span>
                      <span className={on ? 'text-amber-500' : 'text-gray-300'}>{on ? '✓' : '○'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex gap-2 shrink-0">
          {onDelete && (
            <button type="button" onClick={onDelete} className="rounded-xl border border-red-200 text-red-500 px-3 py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950 mr-auto">Supprimer</button>
          )}
          {onDuplicate && (
            <button type="button" onClick={onDuplicate} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Dupliquer</button>
          )}
          <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Annuler</button>
          <button type="button" onClick={handleSave} disabled={saving} className="rounded-xl bg-primary-600 text-white px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50">{saving ? '…' : 'Sauvegarder'}</button>
        </div>
      </div>
    </div>
  )
}
