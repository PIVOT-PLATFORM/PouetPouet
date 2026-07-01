'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PenLine, Upload, FileText, Trash2, Plus, Loader2, Users, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useEnvelopes, type SignStatus } from '@/hooks/useSigndoc'

const STATUS_LABEL: Record<SignStatus, { label: string; cls: string }> = {
  DRAFT:       { label: 'Brouillon',   cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  SENT:        { label: 'Envoyée',     cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  IN_PROGRESS: { label: 'En cours',    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
  COMPLETED:   { label: 'Signée',      cls: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' },
  DECLINED:    { label: 'Refusée',     cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
  EXPIRED:     { label: 'Expirée',     cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
  VOIDED:      { label: 'Annulée',     cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
}

interface PdfDoc { id: string; name: string; pageCount: number }

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { uploadEnvelope, fromPdf } = useEnvelopes()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfs, setPdfs] = useState<PdfDoc[] | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  async function handleUpload(file: File) {
    setError(null); setBusy(true)
    try {
      const env = await uploadEnvelope(file)
      onCreated(env.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setBusy(false)
    }
  }

  async function openPicker() {
    setShowPicker(true)
    if (!pdfs) {
      try { setPdfs(await api.get<PdfDoc[]>('/api/pdf')) } catch { setPdfs([]) }
    }
  }

  async function pickPdf(doc: PdfDoc) {
    setError(null); setBusy(true)
    try {
      const env = await fromPdf(doc.id)
      onCreated(env.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Nouvelle demande de signature</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>

        {busy ? (
          <div className="flex items-center gap-2 justify-center py-10 text-gray-500"><Loader2 className="animate-spin" size={18} /> Création…</div>
        ) : showPicker ? (
          <div className="flex flex-col gap-1 max-h-80 overflow-auto">
            <button onClick={() => setShowPicker(false)} className="self-start text-xs text-teal-600 dark:text-teal-400 hover:underline mb-1">← Retour</button>
            {pdfs === null ? (
              <p className="text-sm text-gray-400 py-6 text-center">Chargement…</p>
            ) : pdfs.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Aucun PDF dans votre bibliothèque.</p>
            ) : (
              pdfs.map((d) => (
                <button key={d.id} onClick={() => pickPdf(d)} className="flex items-center gap-3 px-3 py-2 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-800">
                  <FileText size={18} className="text-teal-600 shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-sm text-gray-800 dark:text-gray-100">{d.name}</span>
                  <span className="text-xs text-gray-400">{d.pageCount}p</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <>
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-teal-300 rounded-2xl p-8 text-center cursor-pointer transition-colors"
            >
              <Upload className="mx-auto mb-2 text-gray-400" size={28} />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Importer un PDF</p>
              <p className="text-xs text-gray-400 mt-0.5">Jusqu&apos;à 100 Mo</p>
              <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
            </div>
            <button onClick={openPicker} className="flex items-center justify-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:underline">
              <FileText size={15} /> Choisir depuis le PDF Manager
            </button>
          </>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  )
}

export default function SigndocPage() {
  const router = useRouter()
  const { envelopes, loading, error, remove } = useEnvelopes()
  const [creating, setCreating] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2"><PenLine size={28} style={{ color: '#0d9488' }} />SignDoc</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {envelopes.length} demande{envelopes.length !== 1 ? 's' : ''} de signature
          </p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 active:scale-95 transition-all shadow-sm">
          <Plus size={16} /> Nouvelle demande
        </button>
      </div>

      {loading && <div className="flex justify-center py-12 text-gray-400"><Loader2 className="animate-spin" size={24} /></div>}
      {!loading && error && <div className="text-center py-12 text-red-500 text-sm">{error}</div>}
      {!loading && !error && envelopes.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <PenLine size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune demande de signature. Créez-en une pour commencer.</p>
        </div>
      )}

      {envelopes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {envelopes.map((e) => {
            const st = STATUS_LABEL[e.status]
            return (
              <div key={e.id} className="group relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:shadow-md transition-all">
                <Link href={`/signdoc/${e.id}`} className="absolute inset-0 rounded-2xl" aria-label={e.name} />
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center shrink-0">
                    <PenLine size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{e.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      {e.role !== 'OWNER' && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          {e.role === 'EDITOR' ? 'Éditeur' : 'Lecteur'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                      <Users size={11} /> {e.recipientCount} signataire{e.recipientCount !== 1 ? 's' : ''} · {e.pageCount}p
                    </p>
                  </div>
                </div>
                {e.role === 'OWNER' && (
                  <button
                    onClick={() => { if (confirm('Supprimer cette demande ?')) remove(e.id) }}
                    title="Supprimer"
                    className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={(id) => router.push(`/signdoc/${id}`)} />}
    </div>
  )
}
