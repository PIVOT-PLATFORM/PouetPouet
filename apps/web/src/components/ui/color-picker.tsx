'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import { BASE_COLORS, getRecentColors, pushRecentColor } from '@/lib/colors'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  columns?: number
}

// Inline color picker: shared base swatches + recently used customs + a full-spectrum
// picker revealed on demand. Stops mousedown so it can live inside draggable surfaces.
export function ColorPicker({ value, onChange, columns = 7 }: ColorPickerProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [recents, setRecents] = useState<string[]>([])
  const norm = (value ?? '').toLowerCase()

  useEffect(() => { setRecents(getRecentColors()) }, [])

  function commitRecent() {
    setRecents(pushRecentColor(value))
  }

  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }

  function swatch(c: string) {
    const selected = norm === c.toLowerCase()
    return (
      <button
        key={c}
        title={c}
        onClick={() => onChange(c)}
        className="relative w-full aspect-square rounded-full transition-transform hover:scale-110"
        style={{ background: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }}
      >
        {selected && <span className="absolute -inset-0.5 rounded-full ring-2 ring-primary-500" />}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 w-44" onMouseDown={(e) => e.stopPropagation()}>
      <div className="grid gap-1.5" style={gridStyle}>
        {BASE_COLORS.map((c) => swatch(c))}
      </div>

      {recents.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Récentes</span>
          <div className="grid gap-1.5" style={gridStyle}>
            {recents.map((c) => swatch(c))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <span
          className="w-4 h-4 rounded-full shrink-0"
          style={{ background: 'conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #0ea5e9, #6366f1, #ec4899, #ef4444)' }}
        />
        Personnalisée
        <svg className={`w-3.5 h-3.5 ml-auto text-gray-400 transition-transform ${showCustom ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showCustom && (
        <div className="pp-colorful flex flex-col gap-2">
          <HexColorPicker color={value} onChange={onChange} onMouseUp={commitRecent} onTouchEnd={commitRecent} />
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md shrink-0" style={{ background: value, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)' }} />
            <HexColorInput
              color={value}
              onChange={onChange}
              onBlur={commitRecent}
              prefixed
              className="flex-1 min-w-0 rounded-md border border-gray-200 px-2 py-1 text-xs uppercase text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-400"
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface ColorPopoverProps {
  value: string
  onChange: (color: string) => void
  title?: string
  align?: 'left' | 'right'
}

// A single current-color swatch that opens the ColorPicker in a fixed-position popover
// (measured off the trigger, like the presence dropdown) so it never breaks tight rows.
export function ColorPopover({ value, onChange, title = 'Couleur', align = 'right' }: ColorPopoverProps) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function toggle() {
    if (open) { setOpen(false); return }
    // Use the enclosing data-popover-anchor element (e.g. the toolbar) for the vertical
    // position only (bottom edge), and the trigger itself for horizontal alignment.
    const anchor = (triggerRef.current?.closest('[data-popover-anchor]') as HTMLElement | null) ?? triggerRef.current
    const trigger = triggerRef.current
    if (anchor && trigger) {
      const anchorRect = anchor.getBoundingClientRect()
      const triggerRect = trigger.getBoundingClientRect()
      // Synthesise a rect: bottom from the anchor, left/right from the trigger.
      setRect(new DOMRect(triggerRect.left, anchorRect.top, triggerRect.width, anchorRect.height))
    } else if (trigger) {
      setRect(trigger.getBoundingClientRect())
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        onClick={toggle}
        className="w-5 h-5 rounded-full ring-1 ring-black/15 shadow-sm hover:scale-110 transition-transform"
        style={{ background: value }}
      />
      {open && rect && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            ...(rect.bottom > window.innerHeight * 0.6
              ? { bottom: window.innerHeight - rect.top + 8 }
              : { top: rect.bottom + 8 }
            ),
            ...(align === 'right' ? { right: window.innerWidth - rect.right } : { left: rect.left }),
          }}
          className="z-[1200] bg-white rounded-2xl shadow-xl border border-gray-100 p-3"
        >
          <ColorPicker value={value} onChange={onChange} />
        </div>,
        document.body
      )}
    </>
  )
}
