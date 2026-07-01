'use client'

import { useRef, useState } from 'react'
import { Pen, Type, Upload, X, Eraser } from 'lucide-react'

// Styles d'écriture pour la signature saisie (formats « professionnels »).
const FONT_STYLES = [
  { label: 'Classique', stack: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive' },
  { label: 'Élégant',   stack: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
  { label: 'Moderne',   stack: '"Gabriola", "Lucida Handwriting", cursive' },
]

type Mode = 'draw' | 'type' | 'upload'

interface Props {
  label: string // « Signature » ou « Paraphe »
  onConfirm: (dataUrl: string) => void
  onClose: () => void
}

// Capture une signature en image PNG (dataURL) selon trois formats : dessin
// libre, saisie en police manuscrite, ou import d'une image.
export function SignaturePad({ label, onConfirm, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('draw')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const hasDrawn = useRef(false)
  const [typed, setTyped] = useState('')
  const [fontIdx, setFontIdx] = useState(0)
  const [uploaded, setUploaded] = useState<string | null>(null)

  // Dessin libre sur le canevas.
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current; if (!c) return
    drawing.current = true; hasDrawn.current = true
    const ctx = c.getContext('2d')!
    const r = c.getBoundingClientRect()
    ctx.beginPath()
    ctx.moveTo(((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height)
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const c = canvasRef.current!; const ctx = c.getContext('2d')!
    const r = c.getBoundingClientRect()
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#111827'
    ctx.lineTo(((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height)
    ctx.stroke()
  }
  function end() { drawing.current = false }
  function clearCanvas() {
    const c = canvasRef.current; if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    hasDrawn.current = false
  }

  // Rend la saisie en image (police manuscrite).
  function typedToDataUrl(): string {
    const c = document.createElement('canvas')
    c.width = 600; c.height = 200
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#111827'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `64px ${FONT_STYLES[fontIdx].stack}`
    ctx.fillText(typed.trim(), c.width / 2, c.height / 2)
    return c.toDataURL('image/png')
  }

  function onFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 600
        const scale = Math.min(1, max / img.width)
        const c = document.createElement('canvas')
        c.width = img.width * scale; c.height = img.height * scale
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        setUploaded(c.toDataURL('image/png'))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  function confirm() {
    if (mode === 'draw') { if (!hasDrawn.current) return; onConfirm(canvasRef.current!.toDataURL('image/png')) }
    else if (mode === 'type') { if (!typed.trim()) return; onConfirm(typedToDataUrl()) }
    else if (uploaded) onConfirm(uploaded)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Votre {label.toLowerCase()}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={16} /></button>
        </div>

        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 text-xs">
          {([['draw', 'Dessiner', Pen], ['type', 'Saisir', Type], ['upload', 'Importer', Upload]] as const).map(([m, lbl, Icon]) => (
            <button key={m} onClick={() => setMode(m)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg font-medium transition-colors ${mode === m ? 'bg-white dark:bg-gray-700 text-teal-600 shadow-sm' : 'text-gray-500'}`}>
              <Icon size={13} /> {lbl}
            </button>
          ))}
        </div>

        {mode === 'draw' && (
          <div className="flex flex-col gap-2">
            <canvas
              ref={canvasRef} width={600} height={200}
              className="w-full h-44 border border-gray-200 dark:border-gray-700 rounded-xl bg-white touch-none cursor-crosshair"
              onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
            />
            <button onClick={clearCanvas} className="self-end flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"><Eraser size={12} /> Effacer</button>
          </div>
        )}

        {mode === 'type' && (
          <div className="flex flex-col gap-2">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Tapez votre nom" className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm" />
            <div className="flex gap-2">
              {FONT_STYLES.map((f, i) => (
                <button key={f.label} onClick={() => setFontIdx(i)} className={`flex-1 px-2 py-3 rounded-xl border text-lg truncate ${fontIdx === i ? 'border-teal-400 bg-teal-50/50 dark:bg-teal-950/20' : 'border-gray-200 dark:border-gray-700'}`} style={{ fontFamily: f.stack }}>
                  {typed.trim() || f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'upload' && (
          <div className="flex flex-col gap-2">
            {uploaded ? (
              <img src={uploaded} alt="" className="w-full h-44 object-contain border border-gray-200 dark:border-gray-700 rounded-xl bg-white" />
            ) : (
              <label className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:border-teal-300 text-gray-400">
                <Upload size={24} className="mb-1" />
                <span className="text-xs">Importer une image</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
              </label>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Annuler</button>
          <button onClick={confirm} className="px-4 py-2 rounded-xl text-sm bg-teal-600 text-white font-medium hover:bg-teal-700">Apposer</button>
        </div>
      </div>
    </div>
  )
}
