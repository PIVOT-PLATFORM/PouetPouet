'use client'

import { use, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, RotateCw, Scissors, Copy, Download, Trash2,
  Loader2, Check, X, GripVertical, ChevronLeft, ChevronRight, Pencil
} from 'lucide-react'
import { usePdfDoc } from '@/hooks/usePdf'
import { PdfPageCanvas } from '@/components/pdf/pdf-page-canvas'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

function PageThumb({
  docId, pageIndex, selected, dragging, dragOver,
  onSelect, onDragStart, onDragEnter, onDragEnd
}: {
  docId: string
  pageIndex: number
  selected: boolean
  dragging: boolean
  dragOver: boolean
  onSelect: (shift: boolean) => void
  onDragStart: () => void
  onDragEnter: () => void
  onDragEnd: () => void
}) {
  const token = getToken()
  const url = `${API_URL}/api/pdf/${docId}/file`

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onClick={e => onSelect(e.shiftKey)}
      className={`relative group cursor-pointer rounded-xl border-2 transition-all select-none ${
        selected ? 'border-red-500 bg-red-50 dark:bg-red-950/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300'
      } ${dragging ? 'opacity-40' : ''} ${dragOver ? 'border-blue-400 scale-105' : ''}`}
    >
      <div className="flex items-center justify-center p-2 min-h-[120px]">
        <PdfPageCanvas
          docUrl={url}
          pageNumber={pageIndex + 1}
          scale={0.25}
          className="max-w-full max-h-[120px] rounded shadow-sm"
        />
      </div>
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-gray-400">
        <GripVertical size={14} />
      </div>
      <div
        onClick={e => { e.stopPropagation(); onSelect(false) }}
        className={`absolute top-1.5 right-1.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
          selected ? 'bg-red-500 border-red-500 opacity-100' : 'border-gray-300 opacity-0 group-hover:opacity-100'
        }`}
      >
        {selected && <Check size={10} className="text-white" />}
      </div>
      <p className="text-center text-xs text-gray-400 pb-1.5">{pageIndex + 1}</p>
    </div>
  )
}

export default function PdfEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { doc, loading, reorder, rotate, extract, split } = usePdfDoc(id)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const lastSelectedRef = useRef<number | null>(null)

  // Modal états
  const [extractName, setExtractName] = useState('')
  const [showExtract, setShowExtract] = useState(false)
  const [splitAt, setSplitAt] = useState('')
  const [showSplit, setShowSplit] = useState(false)

  function flash(kind: 'ok' | 'err', msg: string) {
    setFeedback({ kind, msg })
    setTimeout(() => setFeedback(null), 3000)
  }

  function toggleSelect(idx: number, shift: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      if (shift && lastSelectedRef.current !== null) {
        const lo = Math.min(lastSelectedRef.current, idx)
        const hi = Math.max(lastSelectedRef.current, idx)
        for (let i = lo; i <= hi; i++) next.add(i)
      } else {
        if (next.has(idx)) next.delete(idx)
        else next.add(idx)
      }
      lastSelectedRef.current = idx
      return next
    })
  }

  function selectAll() {
    if (!doc) return
    setSelected(new Set(Array.from({ length: doc.pageCount }, (_, i) => i)))
  }

  function clearSelection() {
    setSelected(new Set())
    lastSelectedRef.current = null
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setFeedback(null)
    try {
      await fn()
      clearSelection()
    } catch (e) {
      flash('err', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRotate(deg: 90 | 180 | 270) {
    if (selected.size === 0) return
    await run(() => rotate(Array.from(selected), deg))
    flash('ok', `${selected.size} page(s) pivotée(s) de ${deg}°`)
  }

  async function handleDelete() {
    if (!doc || selected.size === 0) return
    const keep = Array.from({ length: doc.pageCount }, (_, i) => i).filter(i => !selected.has(i))
    if (keep.length === 0) { flash('err', 'Impossible de supprimer toutes les pages.'); return }
    await run(() => reorder(keep))
    flash('ok', `${selected.size} page(s) supprimée(s)`)
  }

  async function handleExtract() {
    if (!extractName.trim()) return
    const pages = Array.from(selected).sort((a, b) => a - b)
    await run(async () => {
      await extract(pages, extractName.trim())
    })
    setShowExtract(false)
    flash('ok', 'Nouveau PDF créé avec les pages sélectionnées')
  }

  async function handleSplit() {
    const boundaries = splitAt
      .split(/[,\s]+/)
      .map(s => parseInt(s.trim(), 10) - 1)
      .filter(n => !isNaN(n) && n > 0 && doc && n < doc.pageCount)
    if (boundaries.length === 0) { flash('err', 'Aucune limite valide.'); return }
    await run(async () => {
      await split(boundaries)
    })
    setShowSplit(false)
    flash('ok', `PDF découpé en ${boundaries.length + 1} parties`)
  }

  function handleDragEnd() {
    if (dragFrom !== null && dragOverIdx !== null && dragFrom !== dragOverIdx && doc) {
      const pages = Array.from({ length: doc.pageCount }, (_, i) => i)
      const [moved] = pages.splice(dragFrom, 1)
      pages.splice(dragOverIdx, 0, moved)
      run(() => reorder(pages))
    }
    setDragFrom(null)
    setDragOverIdx(null)
  }

  async function handleDownload() {
    const token = getToken()
    const res = await fetch(`${API_URL}/api/pdf/${id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) { flash('err', 'Téléchargement impossible.'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${doc?.name ?? 'document'}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center py-24 gap-4">
        <p className="text-gray-500">Document introuvable.</p>
        <Link href="/pdf" className="text-sm text-red-600 hover:underline">Retour à la bibliothèque</Link>
      </div>
    )
  }

  const pageIndices = Array.from({ length: doc.pageCount }, (_, i) => i)

  return (
    <div className="flex flex-col gap-4 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/pdf" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{doc.name}</h1>
          <p className="text-xs text-gray-400">{doc.pageCount} page{doc.pageCount > 1 ? 's' : ''} · {doc.sizeLabel}</p>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Download size={14} /> Télécharger
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`text-sm rounded-xl px-4 py-2 ${feedback.kind === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-950/30'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Toolbar sélection */}
      <div className="flex items-center gap-2 flex-wrap min-h-[40px]">
        <button onClick={selectAll} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2">
          Tout sélectionner
        </button>
        {selected.size > 0 && (
          <>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-500">{selected.size} sélectionné(e){selected.size > 1 ? 's' : ''}</span>
            <button onClick={clearSelection} className="text-xs text-gray-400 hover:text-gray-600"><X size={12} /></button>
          </>
        )}

        {selected.size > 0 && !busy && (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {/* Rotation */}
            <div className="flex items-center gap-1 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              {([90, 180, 270] as const).map(deg => (
                <button
                  key={deg}
                  onClick={() => handleRotate(deg)}
                  title={`Pivoter de ${deg}°`}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-r last:border-r-0 border-gray-200 dark:border-gray-700"
                >
                  <RotateCw size={12} /> {deg}°
                </button>
              ))}
            </div>

            <button
              onClick={() => { setExtractName(selected.size === 1 ? `${doc.name} — p.${Array.from(selected)[0] + 1}` : `${doc.name} — extrait`); setShowExtract(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Copy size={12} /> Extraire
            </button>

            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Trash2 size={12} /> Supprimer
            </button>
          </div>
        )}

        {!busy && doc.pageCount > 1 && (
          <button
            onClick={() => { setSplitAt(''); setShowSplit(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 ml-auto"
          >
            <Scissors size={12} /> Découper
          </button>
        )}

        {busy && <Loader2 size={16} className="animate-spin text-gray-400 ml-auto" />}
      </div>

      {/* Grille de pages */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {pageIndices.map(idx => (
          <PageThumb
            key={idx}
            docId={id}
            pageIndex={idx}
            selected={selected.has(idx)}
            dragging={dragFrom === idx}
            dragOver={dragOverIdx === idx}
            onSelect={shift => toggleSelect(idx, shift)}
            onDragStart={() => setDragFrom(idx)}
            onDragEnter={() => setDragOverIdx(idx)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {/* Modal extraire */}
      {showExtract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowExtract(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">
              Extraire {selected.size} page{selected.size > 1 ? 's' : ''} vers un nouveau PDF
            </h2>
            <label className="text-sm text-gray-600 dark:text-gray-400">Nom du nouveau fichier</label>
            <input
              autoFocus
              value={extractName}
              onChange={e => setExtractName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleExtract() }}
              className="mt-1 w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowExtract(false)} className="px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Annuler</button>
              <button onClick={handleExtract} className="px-4 py-2 rounded-xl text-sm bg-red-600 text-white font-medium hover:bg-red-700">Extraire</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal découper */}
      {showSplit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowSplit(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1 text-gray-900 dark:text-gray-100">Découper le PDF</h2>
            <p className="text-xs text-gray-400 mb-4">Entrez les numéros de pages où commencer les nouvelles parties (ex : 3, 7 pour un découpage en 3 parties).</p>
            <label className="text-sm text-gray-600 dark:text-gray-400">Couper avant les pages (séparées par des virgules)</label>
            <input
              autoFocus
              value={splitAt}
              onChange={e => setSplitAt(e.target.value)}
              placeholder={`ex: 3, 7  (total: ${doc.pageCount} pages)`}
              onKeyDown={e => { if (e.key === 'Enter') handleSplit() }}
              className="mt-1 w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl px-3 py-2 text-sm"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowSplit(false)} className="px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Annuler</button>
              <button onClick={handleSplit} className="px-4 py-2 rounded-xl text-sm bg-red-600 text-white font-medium hover:bg-red-700">Découper</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
