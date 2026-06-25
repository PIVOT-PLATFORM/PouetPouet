'use client'

import { useRef, useState } from 'react'

interface Crop { x: number; y: number; x2: number; y2: number }
type Handle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const MIN_CROP = 0.04

function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }

interface Props {
  src: string
  onConfirm: (dataUrl: string, naturalW: number, naturalH: number) => void
  onClose: () => void
}

export function CropModal({ src, onConfirm, onClose }: Props) {
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>({ x: 0.05, y: 0.05, x2: 0.95, y2: 0.95 })
  const dragRef = useRef<{ handle: Handle; mx: number; my: number; c0: Crop } | null>(null)

  function startDrag(handle: Handle, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { handle, mx: e.clientX, my: e.clientY, c0: { ...crop } }

    function onMove(ev: MouseEvent) {
      const d = dragRef.current!
      const rect = imgRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = (ev.clientX - d.mx) / rect.width
      const dy = (ev.clientY - d.my) / rect.height
      let { x, y, x2, y2 } = d.c0

      if (handle === 'move') {
        const w = x2 - x, h = y2 - y
        x = clamp01(x + dx); x2 = x + w
        if (x2 > 1) { x2 = 1; x = 1 - w }
        y = clamp01(y + dy); y2 = y + h
        if (y2 > 1) { y2 = 1; y = 1 - h }
      } else {
        if (handle.includes('w')) x = clamp01(x + dx)
        if (handle.includes('e')) x2 = clamp01(x2 + dx)
        if (handle.includes('n')) y = clamp01(y + dy)
        if (handle.includes('s')) y2 = clamp01(y2 + dy)
      }

      if (x2 - x < MIN_CROP) { if (handle.includes('w')) x = x2 - MIN_CROP; else x2 = x + MIN_CROP }
      if (y2 - y < MIN_CROP) { if (handle.includes('n')) y = y2 - MIN_CROP; else y2 = y + MIN_CROP }
      setCrop({ x, y, x2, y2 })
    }

    function onUp() {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function handleConfirm() {
    const img = imgRef.current
    if (!img) return
    const nw = img.naturalWidth, nh = img.naturalHeight
    const sx = Math.round(crop.x * nw)
    const sy = Math.round(crop.y * nh)
    const sw = Math.max(1, Math.round((crop.x2 - crop.x) * nw))
    const sh = Math.max(1, Math.round((crop.y2 - crop.y) * nh))
    const canvas = document.createElement('canvas')
    canvas.width = sw; canvas.height = sh
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
    onConfirm(canvas.toDataURL('image/png'), sw, sh)
  }

  const { x, y, x2, y2 } = crop
  const handles: [Handle, number, number, string][] = [
    ['nw', 0, 0, 'nw-resize'], ['n', 50, 0, 'n-resize'], ['ne', 100, 0, 'ne-resize'],
    ['e', 100, 50, 'e-resize'], ['se', 100, 100, 'se-resize'],
    ['s', 50, 100, 's-resize'], ['sw', 0, 100, 'sw-resize'], ['w', 0, 50, 'w-resize'],
  ]

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 flex flex-col items-center justify-center gap-4"
      onClick={onClose}
    >
      <div className="flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        {/* Image + overlays */}
        <div className="relative select-none" style={{ maxWidth: '80vw', maxHeight: '75vh' }}>
          <img
            ref={imgRef}
            src={src}
            alt=""
            className="block max-w-full max-h-[75vh] object-contain"
            draggable={false}
          />

          {/* Dark mask — 4 strips around the crop rect */}
          <div className="absolute inset-x-0 top-0 bg-black/55 pointer-events-none" style={{ height: `${y * 100}%` }} />
          <div className="absolute inset-x-0 bottom-0 bg-black/55 pointer-events-none" style={{ height: `${(1 - y2) * 100}%` }} />
          <div className="absolute left-0 bg-black/55 pointer-events-none" style={{ top: `${y * 100}%`, bottom: `${(1 - y2) * 100}%`, width: `${x * 100}%` }} />
          <div className="absolute right-0 bg-black/55 pointer-events-none" style={{ top: `${y * 100}%`, bottom: `${(1 - y2) * 100}%`, width: `${(1 - x2) * 100}%` }} />

          {/* Crop rectangle */}
          <div
            className="absolute border border-white/90"
            style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${(x2 - x) * 100}%`, height: `${(y2 - y) * 100}%`, cursor: 'move' }}
            onMouseDown={(e) => startDrag('move', e)}
          >
            {/* Rule-of-thirds grid */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: 'linear-gradient(to right,rgba(255,255,255,0.2) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.2) 1px,transparent 1px)',
              backgroundSize: '33.33% 33.33%',
            }} />

            {/* Resize handles */}
            {handles.map(([handle, px, py, cursor]) => (
              <div
                key={handle}
                style={{
                  position: 'absolute',
                  left: `${px}%`, top: `${py}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 10, height: 10,
                  background: 'white',
                  border: '1.5px solid rgba(0,0,0,0.35)',
                  borderRadius: 2,
                  cursor,
                }}
                onMouseDown={(e) => startDrag(handle, e)}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            Rogner
          </button>
        </div>
      </div>
    </div>
  )
}
