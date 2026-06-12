'use client'

import { useState, useRef } from 'react'

export interface PdfPageData {
  dataUrl: string
  width: number
  height: number
}

interface Props {
  onClose: () => void
  onImport: (pages: PdfPageData[]) => void
}

type Step = 'pick' | 'rendering' | 'preview' | 'error'

const MAX_DIM = 900  // max px for rendered page (width or height)

export function ImportPdfModal({ onClose, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('pick')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [pages, setPages] = useState<PdfPageData[]>([])
  const [error, setError] = useState('')

  async function handleFile(file: File) {
    setStep('rendering')
    setProgress({ current: 0, total: 0 })
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) })
      const pdf = await loadingTask.promise
      const total = pdf.numPages
      setProgress({ current: 0, total })

      const results: PdfPageData[] = []
      for (let i = 1; i <= total; i++) {
        setProgress({ current: i, total })
        const page = await pdf.getPage(i)
        const vp0 = page.getViewport({ scale: 1 })
        const scale = Math.min(MAX_DIM / vp0.width, MAX_DIM / vp0.height, 2)
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = Math.round(viewport.width)
        canvas.height = Math.round(viewport.height)
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas context unavailable')
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        results.push({
          dataUrl: canvas.toDataURL('image/jpeg', 0.92),
          width: canvas.width,
          height: canvas.height,
        })
      }

      setPages(results)
      setStep('preview')
    } catch (err) {
      setError((err as Error).message ?? 'Impossible de lire le PDF.')
      setStep('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Importer un PDF</h2>
              <p className="text-xs text-gray-500">Chaque page devient une carte image</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step: pick */}
        {step === 'pick' && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 py-8 flex flex-col items-center gap-2 transition-colors text-gray-500 hover:text-primary-600"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium">Choisir un fichier PDF</span>
            </button>
          </>
        )}

        {/* Step: rendering */}
        {step === 'rendering' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">
              {progress.total > 0
                ? `Rendu de la page ${progress.current} / ${progress.total}…`
                : 'Chargement du PDF…'}
            </p>
            {progress.total > 0 && (
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-primary-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Step: preview */}
        {step === 'preview' && pages.length > 0 && (
          <>
            <div className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
              <img
                src={pages[0].dataUrl}
                alt="Page 1"
                className="w-16 h-auto rounded-lg shadow border border-gray-200 shrink-0 object-contain"
              />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-gray-900">
                  {pages.length} page{pages.length > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {pages[0].width} × {pages[0].height} px par page
                </p>
                {pages.length > 1 && (
                  <p className="text-xs text-gray-400">
                    Disposées en ligne horizontalement
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => onImport(pages)}
                className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
              >
                Importer
              </button>
            </div>
          </>
        )}

        {/* Step: error */}
        {step === 'error' && (
          <>
            <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700">{error}</div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={() => { setStep('pick'); setError('') }}
                className="px-4 py-2 text-sm rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
              >
                Réessayer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
