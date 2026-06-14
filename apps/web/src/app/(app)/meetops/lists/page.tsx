'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMeetDistLists } from '@/hooks/useMeetDistLists'
import type { MeetDistList } from '@/lib/meetops'

// ── Carte d'une liste (édition membres) ─────────────────────────────────────────

function ListCard({
  list, onRename, onDelete, onAddMember, onRemoveMember,
}: {
  list: MeetDistList
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
  onAddMember: (email: string, name: string) => Promise<void>
  onRemoveMember: (memberId: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    await onAddMember(email.trim(), name.trim())
    setEmail(''); setName('')
  }

  async function rename() {
    const next = prompt('Nom de la liste', list.name)
    if (next && next.trim() && next.trim() !== list.name) await onRename(next.trim())
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          📋 {list.name}
          <span className="text-xs font-normal text-gray-400">{list.members.length} membre{list.members.length > 1 ? 's' : ''}</span>
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={rename} className="text-xs font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded-lg">Renommer</button>
          <button onClick={() => { if (confirm(`Supprimer la liste « ${list.name} » ?`)) onDelete() }}
            className="text-xs text-gray-400 hover:text-red-500 px-1" title="Supprimer">✕</button>
        </div>
      </div>

      {list.members.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-3">
          {list.members.map((m) => (
            <li key={m.id} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full pl-2.5 pr-1 py-0.5 text-xs text-gray-700 dark:text-gray-300">
              {m.name ? `${m.name} (${m.email})` : m.email}
              <button onClick={() => onRemoveMember(m.id)} className="text-gray-400 hover:text-red-500 px-1" title="Retirer">✕</button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="flex gap-1.5">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="email@exemple.fr"
          className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (optionnel)"
          className="w-32 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <button type="submit" disabled={!email.trim()}
          className="px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-gray-800 disabled:opacity-40 rounded-lg">+ Membre</button>
      </form>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function MeetopsListsPage() {
  const { lists, isLoading, createList, renameList, deleteList, addMember, removeMember } = useMeetDistLists()
  const [newName, setNewName] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await createList(newName.trim())
    setNewName('')
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/meetops" className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">← MeetOps</Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-2">📋 Listes de diffusion</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Groupes de destinataires réutilisables — applicables à une réunion en un clic.</p>
      </div>

      <form onSubmit={handleCreate} className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom d'une nouvelle liste (ex. Direction, Équipe DevOps…)"
          className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <button type="submit" disabled={!newName.trim()}
          className="px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl transition-all shadow-sm shadow-primary-200 active:scale-95">+ Liste</button>
      </form>

      {isLoading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : lists.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 dark:text-gray-400">Aucune liste pour le moment.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onRename={(name) => renameList(list.id, name)}
              onDelete={() => deleteList(list.id)}
              onAddMember={(email, name) => addMember(list.id, { email, name: name || null })}
              onRemoveMember={(memberId) => removeMember(list.id, memberId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
