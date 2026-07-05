'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft, KanbanSquare, List as ListIcon, Plus, RotateCcw, Share2, Star, Trash2, UserPlus, XCircle } from 'lucide-react'
import { useTodoList, useTodoListCollaborators, type TodoPriority, type TodoItemStatus, type TodoItem, type TodoCollaborator } from '@/hooks/useTodo'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { useAuthStore } from '@/store/auth'
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

const KANBAN_COLUMNS: { key: TodoItemStatus; label: string; color: string }[] = [
  { key: 'TODO', label: 'À faire', color: '#f97316' },
  { key: 'IN_PROGRESS', label: 'En cours', color: '#3b82f6' },
  { key: 'BLOCKED', label: 'Bloqué', color: '#dc2626' },
  { key: 'DONE', label: 'Fait', color: '#16a34a' },
]
const CANCELLED_COLUMN: { key: TodoItemStatus; label: string; color: string } = { key: 'CANCELLED', label: 'Annulé', color: '#6b7280' }

function initials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2) || '?'
}

// ── Assignation ───────────────────────────────────────────────────────────────

function AssigneeAvatars({ assigneeIds, collaborators }: { assigneeIds: string[]; collaborators: TodoCollaborator[] }) {
  const people = assigneeIds.map((id) => collaborators.find((c) => c.id === id)).filter((c): c is TodoCollaborator => !!c)
  if (people.length === 0) return null
  return (
    <div className="flex -space-x-1.5 shrink-0">
      {people.slice(0, 3).map((p) => (
        <div key={p.id} title={p.name} className="w-5 h-5 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
          {initials(p.name)}
        </div>
      ))}
      {people.length > 3 && (
        <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
          +{people.length - 3}
        </div>
      )}
    </div>
  )
}

function AssigneePicker({ assigneeIds, collaborators, onChange }: { assigneeIds: string[]; collaborators: TodoCollaborator[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false)
  if (collaborators.length === 0) return null

  function toggle(id: string) {
    onChange(assigneeIds.includes(id) ? assigneeIds.filter((a) => a !== id) : [...assigneeIds, id])
  }

  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen((v) => !v)} title="Assigner" className="p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-orange-500 transition-opacity">
        <UserPlus size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-52 p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-20 flex flex-col gap-0.5 max-h-56 overflow-y-auto">
            {collaborators.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm dark:text-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                <input type="checkbox" checked={assigneeIds.includes(c.id)} onChange={() => toggle(c.id)} className="w-3.5 h-3.5 rounded accent-orange-500" />
                {c.name}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Kanban ────────────────────────────────────────────────────────────────────

function TodoCard({ item, collaborators, canEdit, isDragging, onDragStart, onDragEnd, onAssign, onCancel, onDelete }: {
  item: TodoItem
  collaborators: TodoCollaborator[]
  canEdit: boolean
  isDragging: boolean
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onAssign: (ids: string[]) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const meta = priorityMeta(item.priority)
  const overdue = item.status !== 'DONE' && item.status !== 'CANCELLED' && item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10)

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; onDragStart(item.id) }}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex flex-col gap-2 shadow-sm transition-opacity ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-40' : 'opacity-100'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 leading-snug flex-1">{item.title}</p>
        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            <AssigneePicker assigneeIds={item.assigneeIds} collaborators={collaborators} onChange={onAssign} />
            {item.status !== 'CANCELLED' ? (
              <button onClick={onCancel} title="Annuler" className="p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-orange-500 transition-opacity"><XCircle size={13} /></button>
            ) : null}
            <button onClick={onDelete} title="Supprimer" className="p-1 rounded text-gray-300 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"><Trash2 size={13} /></button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {item.priority !== 'NONE' && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: meta.color + '1a', color: meta.color }}>{meta.label}</span>
        )}
        {item.dueDate && (
          <span className={`text-[11px] ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{item.dueDate}</span>
        )}
      </div>
      <AssigneeAvatars assigneeIds={item.assigneeIds} collaborators={collaborators} />
    </div>
  )
}

function KanbanColumn({ col, items, collaborators, canEdit, draggedId, onDragStart, onDragEnd, onMove, onAssign, onCancel, onDelete }: {
  col: { key: TodoItemStatus; label: string; color: string }
  items: TodoItem[]
  collaborators: TodoCollaborator[]
  canEdit: boolean
  draggedId: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onMove: (id: string, status: TodoItemStatus) => void
  onAssign: (id: string, ids: string[]) => void
  onCancel: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [isOver, setIsOver] = useState(false)
  const overCount = useRef(0)

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  function handleDragEnter(e: React.DragEvent) { e.preventDefault(); overCount.current += 1; setIsOver(true) }
  function handleDragLeave() { overCount.current -= 1; if (overCount.current === 0) setIsOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    overCount.current = 0
    setIsOver(false)
    const id = e.dataTransfer.getData('text/plain')
    const already = items.some((i) => i.id === id)
    if (!id || already) return
    onMove(id, col.key)
  }

  const isDraggingOver = isOver && draggedId !== null
  const containsDragged = items.some((i) => i.id === draggedId)

  return (
    <div
      className={`flex flex-col flex-1 min-w-[220px] min-h-0 rounded-2xl transition-colors ${isDraggingOver ? 'bg-orange-50 dark:bg-orange-950/20' : 'bg-transparent'}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 mb-3 shrink-0 px-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col.color }} />
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{col.label}</span>
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{items.length}</span>
      </div>
      <div className={`flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 px-1 pb-2 ${isDraggingOver && !containsDragged ? 'ring-2 ring-orange-400 ring-inset rounded-xl' : ''}`}>
        {items.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-gray-100 dark:border-gray-800 py-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-600">{isDraggingOver ? 'Déposer ici' : 'Vide'}</p>
          </div>
        )}
        {items.map((item) => (
          <TodoCard
            key={item.id}
            item={item}
            collaborators={collaborators}
            canEdit={canEdit}
            isDragging={item.id === draggedId}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onAssign={(ids) => onAssign(item.id, ids)}
            onCancel={() => onCancel(item.id)}
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

export default function TodoListDetailPage() {
  useFlagGuard('module.todo')
  const { id } = useParams<{ id: string }>()
  const { list, isLoading, notFound, updateList, toggleFavorite, addItem, updateItem, deleteItem } = useTodoList(id)
  const user = useAuthStore((s) => s.user)

  const [editingName, setEditingName] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<TodoPriority>('NONE')
  const [newDueDate, setNewDueDate] = useState('')
  const [showShare, setShowShare] = useState(false)
  const [view, setView] = useState<'list' | 'kanban'>('list')
  const [showCancelled, setShowCancelled] = useState(false)
  const [filterMembers, setFilterMembers] = useState<Set<string>>(new Set())
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const canEdit = list ? list.role === 'OWNER' || list.role === 'EDITOR' : false
  const isOwner = list?.role === 'OWNER'
  const collaborators = useTodoListCollaborators(id, user, isOwner ?? false, canEdit)

  const visibleItems = useMemo(() => {
    if (!list) return []
    return list.items.filter((item) => {
      if (!showCancelled && item.status === 'CANCELLED') return false
      if (filterMembers.size > 0 && !item.assigneeIds.some((a) => filterMembers.has(a))) return false
      return true
    })
  }, [list, showCancelled, filterMembers])

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

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    await addItem({ title: newTitle.trim(), priority: newPriority, dueDate: newDueDate || null })
    setNewTitle('')
    setNewPriority('NONE')
    setNewDueDate('')
  }

  function toggleMemberFilter(memberId: string) {
    setFilterMembers((prev) => {
      const next = new Set(prev)
      if (next.has(memberId)) next.delete(memberId)
      else next.add(memberId)
      return next
    })
  }

  const kanbanColumns = showCancelled ? [...KANBAN_COLUMNS, CANCELLED_COLUMN] : KANBAN_COLUMNS

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
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === 'list' ? 'bg-orange-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              <ListIcon className="w-4 h-4" /> Liste
            </button>
            <button onClick={() => setView('kanban')} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${view === 'kanban' ? 'bg-orange-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              <KanbanSquare className="w-4 h-4" /> Kanban
            </button>
          </div>
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

      {/* Filtres : membres + tâches annulées */}
      {(collaborators.length > 0 || list.items.some((i) => i.status === 'CANCELLED')) && (
        <div className="flex items-center gap-3 flex-wrap">
          {collaborators.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {collaborators.map((c) => {
                const active = filterMembers.has(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleMemberFilter(c.id)}
                    title={c.name}
                    className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center ring-2 transition-all ${active ? 'bg-orange-500 text-white ring-orange-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600'}`}
                  >
                    {initials(c.name)}
                  </button>
                )
              })}
              {filterMembers.size > 0 && (
                <button onClick={() => setFilterMembers(new Set())} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2">Effacer le filtre</button>
              )}
            </div>
          )}
          {list.items.some((i) => i.status === 'CANCELLED') && (
            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
              <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="w-3.5 h-3.5 rounded accent-orange-500" />
              Afficher les tâches annulées
            </label>
          )}
        </div>
      )}

      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto flex-1 min-h-0 pb-4" style={{ minHeight: '50vh' }}>
          {kanbanColumns.map((col) => (
            <KanbanColumn
              key={col.key}
              col={col}
              items={visibleItems.filter((i) => i.status === col.key)}
              collaborators={collaborators}
              canEdit={canEdit}
              draggedId={draggedId}
              onDragStart={setDraggedId}
              onDragEnd={() => setDraggedId(null)}
              onMove={(itemId, status) => updateItem(itemId, { status })}
              onAssign={(itemId, ids) => updateItem(itemId, { assigneeIds: ids })}
              onCancel={(itemId) => updateItem(itemId, { status: 'CANCELLED' })}
              onDelete={(itemId) => deleteItem(itemId)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex flex-col gap-3">
          {visibleItems.length === 0 ? (
            <p className="text-sm text-gray-400">Aucune tâche pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {visibleItems.map((item) => {
                const meta = priorityMeta(item.priority)
                const cancelled = item.status === 'CANCELLED'
                const overdue = item.status !== 'DONE' && item.status !== 'CANCELLED' && item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10)
                return (
                  <li key={item.id} className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 group ${cancelled ? 'opacity-60' : ''}`}>
                    <input
                      type="checkbox"
                      checked={item.status === 'DONE'}
                      disabled={!canEdit || cancelled}
                      onChange={(e) => updateItem(item.id, { status: e.target.checked ? 'DONE' : 'TODO' })}
                      className="w-4 h-4 accent-orange-500 shrink-0"
                    />
                    <span className={`flex-1 text-sm ${item.status !== 'TODO' && item.status !== 'IN_PROGRESS' && item.status !== 'BLOCKED' ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>{item.title}</span>
                    {cancelled && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 bg-gray-100 dark:bg-gray-800 text-gray-400">Annulé</span>
                    )}
                    {item.status === 'IN_PROGRESS' && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">En cours</span>
                    )}
                    {item.status === 'BLOCKED' && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">Bloqué</span>
                    )}
                    {item.priority !== 'NONE' && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0" style={{ background: meta.color + '1a', color: meta.color }}>{meta.label}</span>
                    )}
                    {item.dueDate && (
                      <span className={`text-xs shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{item.dueDate}</span>
                    )}
                    <AssigneeAvatars assigneeIds={item.assigneeIds} collaborators={collaborators} />
                    {canEdit && (
                      <>
                        <AssigneePicker assigneeIds={item.assigneeIds} collaborators={collaborators} onChange={(ids) => updateItem(item.id, { assigneeIds: ids })} />
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
      )}

      {showShare && <ModuleShareModal module="todolist" resourceId={list.id} resourceName={list.name} onClose={() => setShowShare(false)} />}
    </div>
  )
}
