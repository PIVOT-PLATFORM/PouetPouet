'use client'

import { useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  FileText, Upload, Loader2, Merge, Trash2, Copy, Pencil, Check, X,
  FolderPlus, Folder, FolderOpen, ChevronRight, ChevronDown, Tag, Home, Search, ArrowUpDown
} from 'lucide-react'
import { usePdfList, usePdfFolders, type PdfDocument, type PdfFolder } from '@/hooks/usePdf'

type SortKey = 'name' | 'date' | 'size' | 'pages'
type SortDir = 'asc' | 'desc'

function sortDocs(docs: PdfDocument[], key: SortKey, dir: SortDir): PdfDocument[] {
  return [...docs].sort((a, b) => {
    let cmp = 0
    if (key === 'name') cmp = a.name.localeCompare(b.name, 'fr')
    else if (key === 'date') cmp = a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
    else if (key === 'size') cmp = a.size - b.size
    else if (key === 'pages') cmp = a.pageCount - b.pageCount
    return dir === 'asc' ? cmp : -cmp
  })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Sidebar arborescence ──────────────────────────────────────────────────────

const DND_TYPE = 'application/pdf-doc-id'

function FolderNode({
  folder, folders, depth, selected, onSelect, onCreate, onRename, onDelete, onDropDoc,
}: {
  folder: PdfFolder
  folders: PdfFolder[]
  depth: number
  selected: string | null
  onSelect: (id: string | null) => void
  onCreate: (parentId: string) => void
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDropDoc: (docId: string, folderId: string | null) => Promise<void>
}) {
  const children = folders.filter(f => f.parentId === folder.id)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(folder.name)
  const [dragOver, setDragOver] = useState(false)
  const isSelected = selected === folder.id

  async function saveRename() {
    if (!editName.trim() || editName === folder.name) { setEditing(false); return }
    await onRename(folder.id, editName.trim())
    setEditing(false)
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer text-sm transition-colors
          ${dragOver ? 'bg-blue-50 border border-blue-300 dark:bg-blue-950/30 dark:border-blue-700' :
            isSelected ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
            'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => { onSelect(folder.id); setOpen(true) }}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault(); e.stopPropagation()
          setDragOver(false)
          const docId = e.dataTransfer.getData(DND_TYPE)
          if (docId) { setOpen(true); onDropDoc(docId, folder.id) }
        }}
      >
        <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }} className="shrink-0 text-gray-400">
          {children.length > 0
            ? (open ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
            : <span className="w-3" />}
        </button>
        {open || dragOver ? <FolderOpen size={14} className="shrink-0" /> : <Folder size={14} className="shrink-0" />}
        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false) }}
            onClick={e => e.stopPropagation()}
            className="flex-1 text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-1 py-0.5"
          />
        ) : (
          <span className="flex-1 truncate text-xs font-medium">{folder.name}</span>
        )}
        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => { setEditName(folder.name); setEditing(true) }} title="Renommer" className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><Pencil size={10} /></button>
          <button onClick={() => onCreate(folder.id)} title="Sous-dossier" className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><FolderPlus size={10} /></button>
          <button onClick={() => onDelete(folder.id)} title="Supprimer" className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-red-400"><Trash2 size={10} /></button>
        </div>
      </div>
      {open && children.map(c => (
        <FolderNode key={c.id} folder={c} folders={folders} depth={depth + 1}
          selected={selected} onSelect={onSelect} onCreate={onCreate}
          onRename={onRename} onDelete={onDelete} onDropDoc={onDropDoc} />
      ))}
    </div>
  )
}

function Sidebar({
  folders, selectedFolder, onSelectFolder, allTags, selectedTag, onSelectTag,
  onCreate, onRename, onDelete, onDropDoc,
}: {
  folders: PdfFolder[]
  selectedFolder: string | null | undefined
  onSelectFolder: (id: string | null | undefined) => void
  allTags: string[]
  selectedTag: string | undefined
  onSelectTag: (t: string | undefined) => void
  onCreate: (parentId?: string) => void
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDropDoc: (docId: string, folderId: string | null) => Promise<void>
}) {
  const roots = folders.filter(f => !f.parentId)
  const [rootDragOver, setRootDragOver] = useState(false)

  return (
    <aside className="w-56 shrink-0 flex flex-col gap-1 pr-2 border-r border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-1 px-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Dossiers</span>
        <button onClick={() => onCreate()} title="Nouveau dossier" className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"><FolderPlus size={14} /></button>
      </div>

      <button
        onClick={() => onSelectFolder(undefined)}
        className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${selectedFolder === undefined && !selectedTag ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
      >
        <Home size={13} /> Tous les PDF
      </button>

      <button
        onClick={() => onSelectFolder(null)}
        onDragOver={e => { e.preventDefault(); setRootDragOver(true) }}
        onDragLeave={() => setRootDragOver(false)}
        onDrop={e => {
          e.preventDefault(); setRootDragOver(false)
          const docId = e.dataTransfer.getData(DND_TYPE)
          if (docId) onDropDoc(docId, null)
        }}
        className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium transition-colors
          ${rootDragOver ? 'bg-blue-50 border border-blue-300 dark:bg-blue-950/30 dark:border-blue-700' :
            selectedFolder === null && !selectedTag ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
            'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
      >
        <Folder size={13} /> Racine
      </button>

      {roots.map(f => (
        <FolderNode key={f.id} folder={f} folders={folders} depth={0}
          selected={typeof selectedFolder === 'string' ? selectedFolder : null}
          onSelect={id => onSelectFolder(id)}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
          onDropDoc={onDropDoc}
        />
      ))}

      {allTags.length > 0 && (
        <>
          <div className="mt-3 mb-1 px-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tags</span>
          </div>
          {allTags.map(t => (
            <button
              key={t}
              onClick={() => onSelectTag(selectedTag === t ? undefined : t)}
              className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${selectedTag === t ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
            >
              <Tag size={12} /> {t}
            </button>
          ))}
        </>
      )}
    </aside>
  )
}

// ── Drop zone ─────────────────────────────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'); if (f.length) onFiles(f) }}
      className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${dragging ? 'border-red-400 bg-red-50 dark:bg-red-950/20' : 'border-gray-200 dark:border-gray-700 hover:border-red-300'}`}
    >
      <Upload className="mx-auto mb-2 text-gray-400" size={28} />
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Déposez vos PDF ici ou cliquez</p>
      <p className="text-xs text-gray-400 mt-0.5">Jusqu&apos;à 100 Mo par fichier</p>
      <input ref={inputRef} type="file" accept="application/pdf" multiple className="hidden"
        onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) onFiles(f); e.target.value = '' }} />
    </div>
  )
}

// ── Tag editor inline ─────────────────────────────────────────────────────────

function TagEditor({ tags, onSave, onEditingChange }: { tags: string[]; onSave: (tags: string[]) => Promise<void>; onEditingChange?: (v: boolean) => void }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [current, setCurrent] = useState(tags)

  function startEdit() { setCurrent(tags); setEditing(true); onEditingChange?.(true) }

  function addTag() {
    const t = input.trim().toLowerCase()
    if (t && !current.includes(t)) setCurrent(prev => [...prev, t])
    setInput('')
  }

  async function save() {
    await onSave(current)
    setEditing(false)
    onEditingChange?.(false)
  }

  function cancel() { setEditing(false); onEditingChange?.(false) }

  if (!editing) {
    return (
      <div className="flex flex-wrap gap-1 mt-1 min-h-[18px]" onClick={e => { e.stopPropagation(); startEdit() }}>
        {tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 cursor-pointer">{t}</span>)}
        {tags.length === 0 && <span className="text-[10px] text-gray-300 cursor-pointer">+ tag</span>}
      </div>
    )
  }

  return (
    <div className="mt-1" onClick={e => e.stopPropagation()}>
      <div className="flex flex-wrap gap-1 mb-1">
        {current.map(t => (
          <span key={t} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400">
            {t}<button onClick={() => setCurrent(prev => prev.filter(x => x !== t))}><X size={8} /></button>
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } if (e.key === 'Escape') cancel() }}
          placeholder="nouveau tag"
          className="flex-1 text-[10px] border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 dark:bg-gray-800 dark:text-white"
        />
        <button onClick={save} className="text-green-600"><Check size={12} /></button>
        <button onClick={cancel} className="text-gray-400"><X size={12} /></button>
      </div>
    </div>
  )
}

// ── Carte PDF ─────────────────────────────────────────────────────────────────

function PdfCard({ doc, selected, onSelect, onRename, onDelete, onDuplicate, onUpdateTags, folders, onMove }: {
  doc: PdfDocument
  selected: boolean
  onSelect: () => void
  onRename: (name: string) => Promise<void>
  onDelete: () => Promise<void>
  onDuplicate: () => Promise<unknown>
  onUpdateTags: (tags: string[]) => Promise<void>
  folders: PdfFolder[]
  onMove: (folderId: string | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(doc.name)
  const [tagEditing, setTagEditing] = useState(false)
  const [showMove, setShowMove] = useState(false)

  async function saveRename() {
    if (!editName.trim() || editName === doc.name) { setEditing(false); return }
    await onRename(editName.trim())
    setEditing(false)
  }

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData(DND_TYPE, doc.id); e.dataTransfer.effectAllowed = 'move' }}
      className={`relative group rounded-xl border-2 transition-all cursor-grab active:cursor-grabbing ${selected ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'}`}
    >
      <button
        onClick={e => { e.preventDefault(); onSelect() }}
        className={`absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-red-500 border-red-500 opacity-100' : 'border-gray-300 opacity-0 group-hover:opacity-100'}`}
      >
        {selected && <Check size={12} className="text-white" />}
      </button>

      {editing ? (
        <div className="p-4 pb-2">
          <div className="flex items-center justify-center h-16 mb-2 text-red-500"><FileText size={40} /></div>
          <input
            autoFocus
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={saveRename}
            className="w-full text-xs font-medium border border-primary-400 rounded-lg px-2 py-1 outline-none ring-2 ring-primary-200 dark:bg-gray-700 dark:border-gray-500 dark:text-white dark:ring-primary-900"
          />
          <p className="text-[10px] text-gray-400 mt-1">{doc.pageCount}p · {doc.sizeLabel}</p>
        </div>
      ) : (
        <>
          <Link href={`/pdf/${doc.id}`} className={`block p-4 pb-1 ${tagEditing ? 'pointer-events-none' : ''}`}>
            <div className="flex items-center justify-center h-16 mb-2 text-red-500"><FileText size={40} /></div>
            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{doc.name}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{doc.pageCount}p · {doc.sizeLabel}</p>
            <p className="text-[10px] text-gray-400">{formatDate(doc.createdAt)}</p>
          </Link>
          <div className="px-4 pb-2">
            <TagEditor tags={doc.tags} onSave={onUpdateTags} onEditingChange={setTagEditing} />
          </div>
        </>
      )}

      {/* Move to folder picker */}
      {showMove && (
        <div className="absolute z-20 top-full left-0 mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1 text-xs" onClick={e => e.stopPropagation()}>
          <button onClick={() => { onMove(null); setShowMove(false) }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">Racine</button>
          {folders.map(f => (
            <button key={f.id} onClick={() => { onMove(f.id); setShowMove(false) }} className="w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 truncate">{f.name}</button>
          ))}
        </div>
      )}

      {!editing && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => { setEditName(doc.name); setEditing(true) }} title="Renommer" className="p-1 rounded bg-white dark:bg-gray-700 shadow text-gray-500 hover:text-gray-700"><Pencil size={11} /></button>
          <button onClick={() => setShowMove(v => !v)} title="Déplacer" className="p-1 rounded bg-white dark:bg-gray-700 shadow text-gray-500 hover:text-gray-700"><Folder size={11} /></button>
          <button onClick={() => onDuplicate()} title="Dupliquer" className="p-1 rounded bg-white dark:bg-gray-700 shadow text-gray-500 hover:text-gray-700"><Copy size={11} /></button>
          <button onClick={() => onDelete()} title="Supprimer" className="p-1 rounded bg-white dark:bg-gray-700 shadow text-red-400 hover:text-red-600"><Trash2 size={11} /></button>
        </div>
      )}
    </div>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function PdfLibraryPage() {
  const [selectedFolder, setSelectedFolder] = useState<string | null | undefined>(undefined)
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined)

  const { docs, loading, error, refresh, upload, rename, updateTags, moveToFolder, remove, duplicate, merge } = usePdfList(
    selectedTag ? undefined : selectedFolder,
    selectedTag,
  )
  const { folders, createFolder, renameFolder, deleteFolder } = usePdfFolders()

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [merging, setMerging] = useState(false)
  const [mergeName, setMergeName] = useState('')
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [newFolderParent, setNewFolderParent] = useState<string | undefined>(undefined)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const allTags = Array.from(new Set(docs.flatMap(d => d.tags))).sort()

  const filteredDocs = sortDocs(
    search.trim() ? docs.filter(d => d.name.toLowerCase().includes(search.trim().toLowerCase())) : docs,
    sortKey, sortDir
  )

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleUpload(files: File[]) {
    setUploadError(null); setUploading(true)
    try {
      const fid = typeof selectedFolder === 'string' ? selectedFolder : undefined
      for (const f of files) await upload(f, fid)
    } catch (e) { setUploadError((e as Error).message) }
    finally { setUploading(false) }
  }

  async function handleMerge() {
    if (!mergeName.trim()) { setMergeError('Donnez un nom au fichier fusionné.'); return }
    setMergeError(null)
    try {
      await merge(Array.from(selected), mergeName.trim(), typeof selectedFolder === 'string' ? selectedFolder : null)
      setSelected(new Set()); setMerging(false); setMergeName('')
    } catch (e) { setMergeError((e as Error).message) }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    await createFolder(newFolderName.trim(), newFolderParent ?? null)
    setNewFolderName(''); setShowNewFolder(false)
  }

  function handleSelectFolder(id: string | null | undefined) {
    setSelectedFolder(id); setSelectedTag(undefined)
  }

  function handleSelectTag(t: string | undefined) {
    setSelectedTag(t); setSelectedFolder(undefined)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><FileText size={28} style={{ color: '#dc2626' }} />PDF Manager</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {search ? `${filteredDocs.length} / ${docs.length}` : docs.length} document{docs.length !== 1 ? 's' : ''}
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

      <div className="flex gap-6">
        {/* Sidebar */}
        <Sidebar
          folders={folders}
          selectedFolder={selectedFolder}
          onSelectFolder={handleSelectFolder}
          allTags={allTags}
          selectedTag={selectedTag}
          onSelectTag={handleSelectTag}
          onCreate={parentId => { setNewFolderParent(parentId); setNewFolderName(''); setShowNewFolder(true) }}
          onRename={renameFolder}
          onDelete={deleteFolder}
          onDropDoc={async (docId, folderId) => { await moveToFolder(docId, folderId); refresh() }}
        />

        {/* Contenu principal */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <DropZone onFiles={handleUpload} />

          {(uploading || uploadError) && (
            <div className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 ${uploadError ? 'bg-red-50 text-red-600 dark:bg-red-950/30' : 'bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400'}`}>
              {uploading && <Loader2 size={14} className="animate-spin shrink-0" />}
              {uploading ? 'Upload en cours…' : uploadError}
            </div>
          )}

          {/* Barre de recherche + tri */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom…"
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 dark:focus:ring-red-800"
              />
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <ArrowUpDown size={13} className="text-gray-400" />
              {(['name', 'date', 'size', 'pages'] as SortKey[]).map(k => (
                <button
                  key={k}
                  onClick={() => toggleSort(k)}
                  className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-0.5
                    ${sortKey === k ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  {k === 'name' ? 'Nom' : k === 'date' ? 'Date' : k === 'size' ? 'Taille' : 'Pages'}
                  {sortKey === k && <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="flex justify-center py-12 text-gray-400"><Loader2 className="animate-spin" size={24} /></div>}
          {!loading && error && <div className="text-center py-12 text-red-500 text-sm">{error}</div>}
          {!loading && !error && filteredDocs.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{search ? 'Aucun résultat pour cette recherche.' : 'Aucun PDF dans cet emplacement.'}</p>
            </div>
          )}

          {filteredDocs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filteredDocs.map(doc => (
                <PdfCard
                  key={doc.id}
                  doc={doc}
                  selected={selected.has(doc.id)}
                  folders={folders}
                  onSelect={() => toggleSelect(doc.id)}
                  onRename={name => rename(doc.id, name)}
                  onDelete={() => remove(doc.id)}
                  onDuplicate={() => duplicate(doc.id)}
                  onUpdateTags={tags => updateTags(doc.id, tags)}
                  onMove={fid => moveToFolder(doc.id, fid)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal nouveau dossier */}
      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewFolder(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold mb-3 text-gray-900 dark:text-gray-100">Nouveau dossier</h2>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder() }}
              placeholder="Nom du dossier"
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm" />
            <div className="flex gap-2 mt-3 justify-end">
              <button onClick={() => setShowNewFolder(false)} className="px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Annuler</button>
              <button onClick={handleCreateFolder} className="px-4 py-2 rounded-xl text-sm bg-red-600 text-white font-medium hover:bg-red-700">Créer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal fusion */}
      {merging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMerging(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">Fusionner {selected.size} PDFs</h2>
            <label className="text-sm text-gray-600 dark:text-gray-400">Nom du fichier résultant</label>
            <input autoFocus value={mergeName} onChange={e => setMergeName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleMerge() }}
              className="mt-1 w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm" />
            {mergeError && <p className="text-xs text-red-500 mt-2">{mergeError}</p>}
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setMerging(false)} className="px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Annuler</button>
              <button onClick={handleMerge} className="px-4 py-2 rounded-xl text-sm bg-red-600 text-white font-medium hover:bg-red-700">Fusionner</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
