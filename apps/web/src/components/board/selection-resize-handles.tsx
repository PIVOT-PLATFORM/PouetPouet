interface Box { minX: number; minY: number; w: number; h: number }

interface Props {
  box: Box
  zoom: number
  onCornerMouseDown: (e: React.MouseEvent, corner: 'nw' | 'ne' | 'sw' | 'se') => void
}

// Cadre englobant + poignées de coin pour le redimensionnement d'une sélection
// multiple ou d'un groupe. Tailles de bordure/poignée constantes à l'écran (÷ zoom).
export function SelectionResizeHandles({ box, zoom, onCornerMouseDown }: Props) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: box.minX, top: box.minY, width: box.w, height: box.h, zIndex: 55 }}
    >
      <div className="absolute inset-0 rounded" style={{ border: `${1.5 / zoom}px dashed #6366f1` }} />
      {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
        const hs = 12 / zoom
        const off = -hs / 2
        const pos: React.CSSProperties =
          corner === 'nw' ? { left: off, top: off, cursor: 'nwse-resize' }
          : corner === 'ne' ? { right: off, top: off, cursor: 'nesw-resize' }
          : corner === 'sw' ? { left: off, bottom: off, cursor: 'nesw-resize' }
          : { right: off, bottom: off, cursor: 'nwse-resize' }
        return (
          <div
            key={corner}
            onMouseDown={(e) => onCornerMouseDown(e, corner)}
            className="absolute bg-white pointer-events-auto"
            style={{ width: hs, height: hs, border: `${1.5 / zoom}px solid #6366f1`, borderRadius: 2 / zoom, ...pos }}
          />
        )
      })}
    </div>
  )
}
