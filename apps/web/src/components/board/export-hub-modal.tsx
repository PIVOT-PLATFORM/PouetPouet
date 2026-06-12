'use client'

export type ExportFormat = 'pdf' | 'image' | 'excel' | 'ppb'

interface Props {
  onClose: () => void
  onExport: (format: ExportFormat) => void
}

export function ExportHubModal({ onClose, onExport }: Props) {
  function pick(format: ExportFormat) {
    onExport(format)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Exporter vers…</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 2×2 grid */}
        <div className="grid grid-cols-2 gap-3">
          <Tile
            onClick={() => pick('pdf')}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            label="PDF"
            desc="Board entier sur une page"
          />
          <Tile
            onClick={() => pick('image')}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            label="Image"
            desc="PNG haute résolution"
          />
          <Tile
            onClick={() => pick('excel')}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M3 6h18M3 14h12M3 18h8" />
              </svg>
            }
            label="Excel"
            desc="Cartes, liaisons, cadres"
          />
          <Tile
            onClick={() => pick('ppb')}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            }
            label="PouetPouet"
            desc="Fichier .ppb réimportable"
            accent
          />
        </div>
      </div>
    </div>
  )
}

function Tile({
  onClick, icon, label, desc, accent,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  desc: string
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all ${
        accent
          ? 'border-primary-200 bg-primary-50/40 hover:border-primary-400 hover:bg-primary-50 text-primary-700'
          : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50/40 text-gray-600 hover:text-primary-700'
      }`}
    >
      <span className={accent ? 'text-primary-500' : 'text-primary-500'}>{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-gray-400 leading-tight">{desc}</span>
    </button>
  )
}
