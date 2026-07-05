'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, Plus, RotateCcw, Share2, Star, Trash2, XCircle } from 'lucide-react'
import { useTodoList, type TodoPriority } from '@/hooks/useTodo'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { Select } from '@/components/ui/select'
import { ModuleShareModal } from '@/components/share/module-share-modal'

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

const PRIORITY_OPTIONS: { value: TodoPriority; label: string; color: string }[] = [
  { value: 'NONE', label: 'Aucune', color: '#9ca3af' },
  { value: 'LOW', label: 'Basse', color: '#3b82f6' },
  { value: 'MEDIUM', label: 'Moyenne', color: '#f59e0b' },
  { value: 'HIGH', label: 'Haute', color: '#dc2626' },
]

function priorityMeta(p: TodoPriority) {
  return PRIORITY_OPTIONS.find((o) => o.value === p) ?? PRIORITY_OPTIONS[0]
}

export default function TodoListDetailPage() {
  useFlagGuard('module.todo')
  const { id } = useParams<{ id: string }>()
  const { list, isLoading, notFound, updateList, toggleFavorite, addItem, updateItem, deleteItem } = useTodoList(id)

  const [editingName, setEditingName] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<TodoPriority>('NONE')
  const [newDueDate, setNewDueDate] = useState('')
  const [showShare, setShowShare] = useState(false)

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (notFound || !list) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Liste introuvable.</p>
        <Link href="/todo" className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700"><ChevronLeft size={16} />Retour à To-Do</Link>
      </div>
    )
  }

  const canEdit = list.role === 'OWNER' || list.role === 'EDITOR'
  const isOwner = list.role === 'OWNER'

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    await addItem({ title: newTitle.trim(), priority: newPriority, dueDate: newDueDate || null })
    setNewTitle('')
    setNewPriority('NONE')
    setNewDueDate('')
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/todo" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={16} />To-Do</Link>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              defaultValue={list.name}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== list.name) updateList({ name: v }); setEditingName(false) }}
              autoFocus
              className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-orange-400 rounded-lg px-2 py-1 -ml-2 focus:outline-none w-full"
            />
          ) : (
            <h1
              onClick={() => canEdit && setEditingName(true)}
              className={`text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight ${canEdit ? 'cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1 -ml-2' : ''}`}
            >
              {list.name}
            </h1>
          )}
          {list.description && <p className="text-gray-500 dark:text-gray-400 mt-1 px-2">{list.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => toggleFavorite()}
            title="Favori"
            className={`p-2.5 rounded-xl transition-all ${list.isFavorite ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-orange-500'}`}
          >
            <Star size={16} fill={list.isFavorite ? 'currentColor' : 'none'} />
          </button>
          {isOwner && (
            <button onClick={() => setShowShare(true)} className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-orange-500 transition-all" title="Partager">
              <Share2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
        {list.items.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune tâche pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {list.items.map((item) => {
              const meta = priorityMeta(item.priority)
              const cancelled = item.status === 'CANCELLED'
              const overdue = item.status === 'TODO' && item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10)
              return (
                <li key={item.id} className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 group ${cancelled ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    checked={item.status === 'DONE'}
                    disabled={!canEdit || cancelled}
                    onChange={(e) => updateItem(item.id, { status: e.target.checked ? 'DONE' : 'TODO' })}
                    className="w-4 h-4 accent-orange-500 shrink-0"
                  />
                  <span className={`flex-1 text-sm ${item.status !== 'TODO' ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>{item.title}</span>
                  {cancelled && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 bg-gray-100 dark:bg-gray-800 text-gray-400">Annulé</span>
                  )}
                  {item.priority !== 'NONE' && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ background: meta.color + '1a', color: meta.color }}>{meta.label}</span>
                  )}
                  {item.dueDate && (
                    <span className={`text-xs shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{item.dueDate}</span>
                  )}
                  {canEdit && (
                    <>
                      {cancelled ? (
                        <button onClick={() => updateItem(item.id, { status: 'TODO' })} title="Réactiver" className="shrink-0 p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-orange-500 transition-opacity"><RotateCcw size={13} /></button>
                      ) : (
                        <button onClick={() => updateItem(item.id, { status: 'CANCELLED' })} title="Annuler" className="shrink-0 p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-orange-500 transition-opacity"><XCircle size={13} /></button>
                      )}
                      <button onClick={() => deleteItem(item.id)} title="Supprimer" className="shrink-0 p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"><Trash2 size={13} /></button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {canEdit && (
          <form onSubmit={handleAddItem} className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Nouvelle tâche…" className={`flex-1 min-w-[180px] ${inputCls}`} maxLength={300} />
            <Select
              className="w-32"
              value={newPriority}
              onChange={(v) => setNewPriority(v as TodoPriority)}
              options={PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <input type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <button type="submit" disabled={!newTitle.trim()} className="shrink-0 flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
              <Plus size={14} /> Ajouter
            </button>
          </form>
        )}
      </div>

      {showShare && <ModuleShareModal module="todolist" resourceId={list.id} resourceName={list.name} onClose={() => setShowShare(false)} />}
    </div>
  )
}
