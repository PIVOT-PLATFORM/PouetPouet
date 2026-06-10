'use client'

interface Props {
  onClose: () => void
  onPickKlaxoon: () => void
  onPickPdf: () => void
  onPickImage: () => void
}

export function ImportHubModal({ onClose, onPickKlaxoon, onPickPdf, onPickImage }: Props) {
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
          <h2 className="text-sm font-semibold text-gray-900">Importer depuis…</h2>
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
            onClick={onPickKlaxoon}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            }
            label="Klaxoon"
            desc="Dossier .klx décompressé"
          />
          <Tile
            onClick={onPickPdf}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            label="PDF"
            desc="Une carte par page"
          />
          <Tile
            onClick={onPickImage}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            label="Image"
            desc="JPG, PNG, GIF, WebP…"
          />
          <Tile
            disabled
            badge="Bientôt"
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M3 6h18M3 14h12M3 18h8" />
              </svg>
            }
            label="Tableur Excel"
            desc=".xlsx, .csv"
          />
        </div>
      </div>
    </div>
  )
}

function Tile({
  onClick, icon, label, desc, disabled, badge,
}: {
  onClick?: () => void
  icon: React.ReactNode
  label: string
  desc: string
  disabled?: boolean
  badge?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all ${
        disabled
          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
          : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-gray-600 hover:text-indigo-700'
      }`}
    >
      {badge && (
        <span className="absolute top-2 right-2 text-[10px] font-semibold bg-amber-100 text-amber-600 rounded-full px-1.5 py-0.5 leading-none">
          {badge}
        </span>
      )}
      <span className={disabled ? 'text-gray-300' : 'text-indigo-500'}>{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-gray-400 leading-tight">{desc}</span>
    </button>
  )
}
