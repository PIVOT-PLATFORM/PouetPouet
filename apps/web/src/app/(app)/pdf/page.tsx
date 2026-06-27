'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { FileText, Upload, Loader2, Merge, Trash2, Copy, Pencil, Check, X } from 'lucide-react'
import { usePdfList, type PdfDocument } from '@/hooks/usePdf'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf')
    if (files.length) onFiles(files)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : 'border-gray-200 dark:border-gray-700 hover:border-red-300'}`}
    >
      <Upload className="mx-auto mb-3 text-gray-400" size={32} />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Déposez vos PDF ici ou cliquez pour parcourir</p>
      <p className="text-xs text-gray-400 mt-1">Jusqu&apos;à 100 Mo par fichier</p>
      <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={e => {
        const files = Array.from(e.target.files ?? [])
        if (files.length) onFiles(files)
        e.target.value = ''
      }} />
    </div>
  )
}

function PdfCard({ doc, selected, onSelect, onRename, onDelete, onDuplicate }: {
  doc: PdfDocument
  selected: boolean
  onSelect: () => void
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
  onDuplicate: () => Promise<unknown>
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(doc.name)
  const [busy, setBusy] = useState(false)

  async function saveRename() {
    if (!editName.trim() || editName === doc.name) { setEditing(false); return }
    setBusy(true)
    try { await onRename(editName.trim()) } finally { setBusy(false); setEditing(false) }
  }

  return (
    <div className={`relative group rounded-xl border transition-all ${selected ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'}`}>
      {/* Checkbox */}
      <button
        onClick={e => { e.preventDefault(); onSelect() }}
        className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-red-500 border-red-500 opacity-100' : 'border-gray-300 opacity-0 group-hover:opacity-100'}`}
      >
        {selected && <Check size={12} className="text-white" />}
      </button>

      <Link href={`/pdf/${doc.id}`} className="block p-4">
        <div className="flex items-center justify-center h-20 mb-3 text-red-500">
          <FileText size={48} />
        </div>
        {editing ? (
          <div className="flex gap-1" onClick={e => e.preventDefault()}>
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false) }}
              className="flex-1 text-sm border rounded px-2 py-0.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <button onClick={saveRename} disabled={busy} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
        ) : (
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{doc.name}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">{doc.pageCount} page{doc.pageCount > 1 ? 's' : ''} · {doc.sizeLabel}</p>
        <p className="text-xs text-gray-400">{formatDate(doc.createdAt)}</p>
      </Link>

      {/* Actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.preventDefault(); setEditing(true) }} title="Renommer" className="p-1 rounded bg-white dark:bg-gray-700 shadow text-gray-500 hover:text-gray-700"><Pencil size={13} /></button>
        <button onClick={e => { e.preventDefault(); onDuplicate() }} title="Dupliquer" className="p-1 rounded bg-white dark:bg-gray-700 shadow text-gray-500 hover:text-gray-700"><Copy size={13} /></button>
        <button onClick={e => { e.preventDefault(); onDelete() }} title="Supprimer" className="p-1 rounded bg-white dark:bg-gray-700 shadow text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

export default function PdfLibraryPage() {
  const { docs, loading, error, upload, rename, remove, duplicate, merge } = usePdfList()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)
  const [mergeName, setMergeName] = useState('')
  const [mergeError, setMergeError] = useState<string | null>(null)

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleUpload(files: File[]) {
    setUploadError(null)
    setUploading(true)
    try {
      for (const f of files) await upload(f)
    } catch (e) {
      setUploadError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleMerge() {
    const ids = Array.from(selected)
    if (!mergeName.trim()) { setMergeError('Donnez un nom au fichier fusionné.'); return }
    setMergeError(null)
    try {
      await merge(ids, mergeName.trim())
      setSelected(new Set())
      setMerging(false)
      setMergeName('')
    } catch (e) {
      setMergeError((e as Error).message)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">PDF Manager</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {docs.length} document{docs.length !== 1 ? 's' : ''}
          </p>
        </div>

        {selected.size >= 2 && (
          <button
            onClick={() => { setMerging(true); setMergeName(docs.filter(d => selected.has(d.id)).map(d => d.name).join(' + ').slice(0, 100)) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700"
          >
            <Merge size={16} /> Fusionner ({selected.size})
          </button>
        )}
      </div>

      <DropZone onFiles={handleUpload} />

      {(uploading || uploadError) && (
        <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 ${uploadError ? 'bg-red-50 text-red-600 dark:bg-red-950/30' : 'bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'}`}>
          {uploading && <Loader2 size={14} className="animate-spin shrink-0" />}
          {uploading ? 'Upload en cours…' : uploadError}
        </div>
      )}

      {/* Merge modal */}
      {merging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMerging(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Fusionner {selected.size} PDFs</h2>
            <label className="text-sm text-gray-600 dark:text-gray-400">Nom du fichier résultant</label>
            <input
              autoFocus
              value={mergeName}
              onChange={e => setMergeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleMerge() }}
              className="mt-1 w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm"
            />
            {mergeError && <p className="text-xs text-red-500 mt-2">{mergeError}</p>}
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setMerging(false)} className="px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Annuler</button>
              <button onClick={handleMerge} className="px-4 py-2 rounded-xl text-sm bg-red-600 text-white font-medium hover:bg-red-700">Fusionner</button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {!loading && error && (
        <div className="text-center py-12 text-red-500 text-sm">{error}</div>
      )}

      {!loading && !error && docs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucun PDF. Importez votre premier document.</p>
        </div>
      )}

      {docs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {docs.map(doc => (
            <PdfCard
              key={doc.id}
              doc={doc}
              selected={selected.has(doc.id)}
              onSelect={() => toggleSelect(doc.id)}
              onRename={name => rename(doc.id, name)}
              onDelete={() => remove(doc.id)}
              onDuplicate={() => duplicate(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
