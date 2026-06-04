'use client'

import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { convertKlaxoon, type KlxImportStats } from '@/lib/klx-import/converter'

interface Props {
  boardId: string
  onClose: () => void
}

type Step = 'pick' | 'reading' | 'preview' | 'importing' | 'done' | 'error'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ImportKlaxoonModal({ boardId, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('pick')
  const [stats, setStats] = useState<KlxImportStats | null>(null)
  const [result, setResult] = useState<{ cards: number; connections: number } | null>(null)
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingRef = useRef<{ cards: any[]; connections: any[] } | null>(null)

  // webkitdirectory is not in standard typings — set via ref after mount
  useEffect(() => {
    if (fileRef.current) fileRef.current.setAttribute('webkitdirectory', '')
  }, [])

  async function handleFolder(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setStep('reading')

    try {
      const fileList = Array.from(files)

      // Find _brainstorm_data.json anywhere in the selected folder
      const jsonFile = fileList.find(f => f.name === '_brainstorm_data.json')
      if (!jsonFile) {
        setError("Fichier _brainstorm_data.json introuvable. Sélectionnez le dossier Activity/<id>/ ou le dossier racine de l'export.")
        setStep('error')
        return
      }

      const jsonText = await jsonFile.text()
      const data = JSON.parse(jsonText)

      // Read all images from mediabundle/ in parallel
      const imageFiles = fileList.filter(f => f.webkitRelativePath.includes('/mediabundle/'))
      const imageMap = new Map<string, string>()
      await Promise.all(imageFiles.map(async (f) => {
        const rel = f.webkitRelativePath
        const mbIdx = rel.indexOf('mediabundle/')
        if (mbIdx < 0) return
        const path = rel.slice(mbIdx) // e.g. "mediabundle/9bf/abc.png"
        const dataUrl = await readFileAsDataUrl(f)
        imageMap.set(path, dataUrl)
      }))

      const { cards, connections, stats: s } = convertKlaxoon(data, imageMap)
      pendingRef.current = { cards, connections }
      setStats(s)
      setStep('preview')
    } catch {
      setError("Impossible de lire le dossier. Vérifiez que c'est bien un export Klaxoon décompressé.")
      setStep('error')
    }
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
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Importer depuis Klaxoon</h2>
              <p className="text-xs text-gray-500">Dossier Activity/&lt;id&gt;/</p>
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
              Décompressez votre export Klaxoon (.klx), puis sélectionnez le dossier&nbsp;
              <code className="bg-gray-100 rounded px-1 text-xs">Activity/&lt;id&gt;/</code>.
              Les images seront importées automatiquement depuis le sous-dossier&nbsp;
              <code className="bg-gray-100 rounded px-1 text-xs">mediabundle/</code>.
            </p>
            <input ref={fileRef} type="file" className="hidden" onChange={handleFolder} />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 py-8 flex flex-col items-center gap-2 transition-colors text-gray-500 hover:text-indigo-600"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <span className="text-sm font-medium">Choisir le dossier</span>
            </button>
          </>
        )}

        {/* Step: reading */}
        {step === 'reading' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">Lecture des fichiers…</p>
          </div>
        )}

        {/* Step: preview */}
        {step === 'preview' && stats && (
          <>
            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aperçu de l&apos;import</p>
              <StatRow icon="🗒️" label="Notes (postits)" value={stats.postits} />
              <StatRow icon="🔤" label="Zones de texte" value={stats.texts} />
              <StatRow icon="✏️" label="Dessins" value={stats.draws} />
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
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
              >
                Importer
              </button>
            </div>
          </>
        )}

        {/* Step: importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
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
            <button onClick={onClose} className="w-full py-2 text-sm rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">
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
              <button onClick={() => { setStep('pick'); setError('') }} className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors">Réessayer</button>
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
