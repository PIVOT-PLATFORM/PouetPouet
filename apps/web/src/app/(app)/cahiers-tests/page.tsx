'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTestBooks } from '@/hooks/useTestBooks'
import type { TestBook, TestBookStatus } from '@/hooks/useTestBooks'
import { FlaskConical } from 'lucide-react'

const STATUS_LABELS: Record<TestBookStatus, string> = {
  DRAFT: 'Brouillon',
  REVIEW: 'En revue',
  APPROVED: 'Approuvé',
  ARCHIVED: 'Archivé',
}
const STATUS_COLORS: Record<TestBookStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  REVIEW: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  APPROVED: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
  ARCHIVED: 'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-500',
}

function CreateModal({ onCreate, onClose }: {
  onCreate: (input: { title: string; description?: string; version?: string }) => Promise<TestBook>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const book = await onCreate({ title: title.trim(), description: description.trim() || undefined, version: version.trim() || undefined })
      router.push(`/cahiers-tests/${book.id}`)
    } catch (err) {
      alert((err as Error).message)
      setSaving(false)
    }
  }

  const inp = 'border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 w-full'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={submit} className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-white">Nouveau cahier de tests</h3>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Titre <span className="text-red-400">*</span></label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cahier de recette v1.2" className={inp} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description (optionnel)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Périmètre, module testé…" className={`${inp} resize-none`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Version (optionnel)</label>
            <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v0.16.0" className={inp} />
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">Annuler</button>
          <button type="submit" disabled={saving || !title.trim()} className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-xl">
            {saving ? 'Création…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  )
}

function BookCard({ book, onDelete }: { book: TestBook; onDelete: () => void }) {
  const sectionCount = book._count?.sections ?? 0

  return (
    <div className="group relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <Link href={`/cahiers-tests/${book.id}`} className="absolute inset-0 rounded-2xl" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
              {book.title}
            </h2>
            {book.version && (
              <span className="shrink-0 text-[11px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                {book.version}
              </span>
            )}
          </div>
          {book.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{book.description}</p>}
        </div>
        <button
          className="relative z-10 shrink-0 text-gray-300 hover:text-red-500 text-sm px-1"
          onClick={(e) => { e.preventDefault(); if (confirm(`Supprimer « ${book.title} » ?`)) onDelete() }}
          title="Supprimer"
        >✕</button>
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[book.status]}`}>
          {STATUS_LABELS[book.status]}
        </span>
        <span>{sectionCount} section{sectionCount !== 1 ? 's' : ''}</span>
        <span className="ml-auto">{new Date(book.updatedAt).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  )
}

export default function TestBooksPage() {
  const { books, isLoading, createBook, deleteBook } = useTestBooks()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><FlaskConical size={28} style={{ color: '#8b5cf6' }} />Cahiers de tests</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Créez et gérez vos cahiers de tests : sections, cas, statuts et résultats.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all shadow-sm shadow-primary-200 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau cahier
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : books.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
          <p className="text-4xl mb-3">🧪</p>
          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Aucun cahier de tests</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Créez votre premier cahier pour structurer vos recettes.</p>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl"
          >
            Créer un cahier
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <BookCard key={book.id} book={book} onDelete={() => deleteBook(book.id)} />
          ))}
        </div>
      )}

      {createOpen && <CreateModal onCreate={createBook} onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
