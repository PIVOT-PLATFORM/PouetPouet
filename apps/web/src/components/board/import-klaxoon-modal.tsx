'use client'

import { useRef, useState } from 'react'
import type JSZip from 'jszip'
import { Upload } from 'lucide-react'
import { api } from '@/lib/api'
import { convertKlaxoon, type KlxCard, type KlxConnection, type KlxImportStats } from '@/lib/klx-import/converter'
import { findKlxActivities, mimeForPath, mediaKey, type KlxActivityEntry } from '@/lib/klx-import/archive'

interface Props {
  boardId: string
  onClose: () => void
}

type Step = 'pick' | 'reading' | 'choose' | 'preview' | 'importing' | 'done' | 'error'

export function ImportKlaxoonModal({ boardId, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const zipRef = useRef<JSZip | null>(null)
  const pendingRef = useRef<{ cards: KlxCard[]; connections: KlxConnection[] } | null>(null)

  const [step, setStep] = useState<Step>('pick')
  const [dragging, setDragging] = useState(false)
  const [activities, setActivities] = useState<KlxActivityEntry[]>([])
  const [stats, setStats] = useState<KlxImportStats | null>(null)
  const [result, setResult] = useState<{ cards: number; connections: number } | null>(null)
  const [error, setError] = useState('')

  // Lit un tableau localisé dans l'archive : son _brainstorm_data.json + les
  // images de son mediabundle/ (encodées en data URL pour convertKlaxoon).
  async function readActivity(activity: KlxActivityEntry) {
    const zip = zipRef.current
    if (!zip) return
    try {
      const jsonText = await zip.files[activity.brainstormPath].async('text')
      const data = JSON.parse(jsonText)

      const imagePaths = Object.keys(zip.files).filter((p) => p.startsWith(activity.mediaPrefix) && !zip.files[p].dir)
      const imageMap = new Map<string, string>()
      await Promise.all(imagePaths.map(async (path) => {
        const base64 = await zip.files[path].async('base64')
        imageMap.set(mediaKey(path), `data:${mimeForPath(path)};base64,${base64}`)
      }))

      const { cards, connections, stats: s } = convertKlaxoon(data, imageMap, process.env.NODE_ENV === 'development')
      pendingRef.current = { cards, connections }
      setStats(s)
      setStep('preview')
    } catch {
      setError("Impossible de lire ce tableau. Le fichier _brainstorm_data.json semble corrompu.")
      setStep('error')
    }
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.klx')) {
      setError("Ce fichier n'est pas une archive .klx.")
      setStep('error')
      return
    }
    setStep('reading')
    try {
      const JSZip = (await import('jszip')).default
      const buffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(buffer)
      zipRef.current = zip

      const entryPaths = Object.keys(zip.files).filter((p) => !zip.files[p].dir)
      const found = findKlxActivities(entryPaths)

      if (found.length === 0) {
        setError("Archive .klx invalide : _brainstorm_data.json introuvable à l'intérieur.")
        setStep('error')
        return
      }
      if (found.length === 1) {
        await readActivity(found[0])
        return
      }
      setActivities(found)
      setStep('choose')
    } catch {
      setError("Impossible de lire l'archive .klx. Vérifiez que le fichier n'est pas corrompu.")
      setStep('error')
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  async function runImport() {
    if (!pendingRef.current) return
    setStep('importing')
    try {
      const res = await api.post(`/api/boards/${boardId}/import/klaxoon`, pendingRef.current) as { cards: number; connections: number }
      setResult(res)
      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'import.")
      setStep('error')
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-primary-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Importer depuis Klaxoon</h2>
              <p className="text-xs text-gray-500">Archive .klx</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step: pick */}
        {step === 'pick' && (
          <>
            <p className="text-sm text-gray-600">
              Déposez votre export Klaxoon (<code className="bg-gray-100 rounded px-1 text-xs">.klx</code>) tel quel — il est décompressé automatiquement et les bons fichiers sont retrouvés pour vous.
            </p>
            <input ref={fileRef} type="file" accept=".klx" className="hidden" onChange={handleInputChange} />
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragging(false)
                const file = e.dataTransfer.files[0]
                if (file) handleFile(file)
              }}
              className={`w-full rounded-xl border-2 border-dashed py-8 flex flex-col items-center gap-2 transition-colors cursor-pointer ${
                dragging ? 'border-primary-400 bg-primary-50/50 text-primary-600' : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 text-gray-500 hover:text-primary-600'
              }`}
            >
              <Upload size={28} />
              <span className="text-sm font-medium">Glissez le fichier .klx ici, ou cliquez pour le choisir</span>
            </div>
          </>
        )}

        {/* Step: reading */}
        {step === 'reading' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Décompression et lecture des fichiers…</p>
          </div>
        )}

        {/* Step: choose — l'archive contient plusieurs tableaux */}
        {step === 'choose' && (
          <>
            <p className="text-sm text-gray-600">Cette archive contient plusieurs tableaux. Lequel importer ?</p>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {activities.map((a) => (
                <button
                  key={a.brainstormPath}
                  onClick={() => { setStep('reading'); readActivity(a) }}
                  className="text-left px-3 py-2 rounded-xl border border-gray-100 hover:border-primary-300 hover:bg-primary-50/50 text-sm text-gray-700 transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
            </div>
          </>
        )}

        {/* Step: preview */}
        {step === 'preview' && stats && (
          <>
            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aperçu de l&apos;import</p>
              <StatRow icon="🗒️" label="Notes (postits)" value={stats.postits} />
              <StatRow icon="🔤" label="Zones de texte" value={stats.texts} />
              <StatRow icon="✏️" label="Dessins" value={stats.draws} />
              <StatRow icon="⬛" label="Formes" value={stats.shapes} />
              <StatRow icon="🖼️" label="Images" value={stats.images} />
              <StatRow icon="🔗" label="Liaisons" value={stats.links} />
              <StatRow icon="🗂️" label="Groupes" value={stats.groups} />
              {stats.skipped > 0 && (
                <StatRow icon="⏭️" label="Ignorés (inactifs…)" value={stats.skipped} muted />
              )}
            </div>
            <p className="text-xs text-gray-400">
              Les dessins et liaisons peuvent avoir des couleurs approximatives.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
              <button
                onClick={runImport}
                className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
              >
                Importer
              </button>
            </div>
          </>
        )}

        {/* Step: importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Import en cours…</p>
          </div>
        )}

        {/* Step: done */}
        {step === 'done' && result && (
          <>
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">Import réussi</p>
              <p className="text-xs text-gray-500 text-center">
                {result.cards} carte{result.cards > 1 ? 's' : ''} et {result.connections} liaison{result.connections > 1 ? 's' : ''} ajoutée{result.connections > 1 ? 's' : ''}.
              </p>
            </div>
            <button onClick={onClose} className="w-full py-2 text-sm rounded-xl bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors">
              Fermer
            </button>
          </>
        )}

        {/* Step: error */}
        {step === 'error' && (
          <>
            <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">{error}</div>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">Fermer</button>
              <button onClick={() => { setStep('pick'); setError('') }} className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors">Réessayer</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatRow({ icon, label, value, muted }: { icon: string; label: string; value: number; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${muted ? 'text-gray-400' : 'text-gray-700'}`}>
      <span className="flex items-center gap-2">{icon} {label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  )
}
