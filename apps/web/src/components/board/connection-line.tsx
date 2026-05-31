'use client'

import type { Connection } from '@/hooks/useBoard'

type Rect = { posX: number; posY: number; width: number; height: number }
type Pt = { x: number; y: number }
type Side = 'n' | 's' | 'e' | 'w'

const DEFAULT_COLOR = '#9ca3af'
const OUT: Record<Side, Pt> = { n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, e: { x: 1, y: 0 }, w: { x: -1, y: 0 } }

// Triangle pointing right (→): tip at (s, s/2), base at x=0.
// refX=s always places the tip at the anchor point (path start or end).
// With auto-start-reverse the marker x-axis is flipped, so refX=s still
// resolves to the tip — the body then extends along the path direction.
function ArrowMarker({ id, size, color, reverse }: { id: string; size: number; color: string; reverse?: boolean }) {
  const s = size
  return (
    <marker
      id={id}
      markerWidth={s} markerHeight={s}
      refX={s} refY={s / 2}
      orient={reverse ? 'auto-start-reverse' : 'auto'}
      markerUnits="userSpaceOnUse"
    >
      <polygon points={`0,0 ${s},${s / 2} 0,${s}`} fill={color} />
    </marker>
  )
}

function center(r: Rect): Pt {
  return { x: r.posX + r.width / 2, y: r.posY + r.height / 2 }
}

// One of the 4 edge midpoints (N/S/E/W) — the side of `r` that faces `t`.
function anchorSide(r: Rect, t: Pt): { p: Pt; side: Side } {
  const c = center(r)
  const dx = t.x - c.x, dy = t.y - c.y
  const horiz = Math.abs(dx) / (r.width / 2 || 1) >= Math.abs(dy) / (r.height / 2 || 1)
  const side: Side = horiz ? (dx >= 0 ? 'e' : 'w') : (dy >= 0 ? 's' : 'n')
  const p: Pt = {
    e: { x: r.posX + r.width, y: c.y },
    w: { x: r.posX, y: c.y },
    s: { x: c.x, y: r.posY + r.height },
    n: { x: c.x, y: r.posY },
  }[side]
  return { p, side }
}

// Path + unit tangents at each end (pointing toward the arrow tip / into the card) +
// label midpoint. Curves and elbows leave each anchor perpendicular to its side.
function buildPath(shape: string, a: Pt, sa: Side, b: Pt, sb: Side) {
  const oa = OUT[sa], ob = OUT[sb]
  // Arrowheads point into the card at each end (opposite the outward side normal).
  const tStart: Pt = { x: -oa.x, y: -oa.y }
  const tEnd: Pt = { x: -ob.x, y: -ob.y }
  const mid: Pt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }

  if (shape === 'straight') {
    return { d: `M${a.x},${a.y} L${b.x},${b.y}`, tStart, tEnd, mid }
  }
  if (shape === 'orthogonal') {
    const stub = 24
    const a1 = { x: a.x + oa.x * stub, y: a.y + oa.y * stub }
    const b1 = { x: b.x + ob.x * stub, y: b.y + ob.y * stub }
    const horizA = sa === 'e' || sa === 'w'
    const corner: Pt = horizA ? { x: b1.x, y: a1.y } : { x: a1.x, y: b1.y }
    return {
      d: `M${a.x},${a.y} L${a1.x},${a1.y} L${corner.x},${corner.y} L${b1.x},${b1.y} L${b.x},${b.y}`,
      tStart, tEnd, mid: corner,
    }
  }
  // curved (default)
  const dist = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.4)
  const c1 = { x: a.x + oa.x * dist, y: a.y + oa.y * dist }
  const c2 = { x: b.x + ob.x * dist, y: b.y + ob.y * dist }
  return { d: `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`, tStart, tEnd, mid }
}

export function ConnectionLine({ conn, from, to, selected, interactive, onSelect }: {
  conn: Connection
  from: Rect
  to: Rect
  selected?: boolean
  interactive?: boolean
  onSelect?: (id: string) => void
}) {
  const fa = anchorSide(from, center(to))
  const tb = anchorSide(to, center(from))
  const a = fa.p, b = tb.p
  const { d, tStart, tEnd, mid } = buildPath(conn.shape, a, fa.side, b, tb.side)
  const color = conn.color || DEFAULT_COLOR
  const w = conn.width || 2
  const strokeColor = selected ? '#6366f1' : color
  const headSize = 7 + w * 1.5
  const hasStart = conn.arrow === 'start' || conn.arrow === 'both'
  const hasEnd   = conn.arrow === 'end'   || conn.arrow === 'both'
  const startId  = `arr-s-${conn.id}`
  const endId    = `arr-e-${conn.id}`

  return (
    <g>
      {(hasStart || hasEnd) && (
        <defs>
          {hasEnd   && <ArrowMarker id={endId}   size={headSize} color={strokeColor} />}
          {hasStart && <ArrowMarker id={startId} size={headSize} color={strokeColor} reverse />}
        </defs>
      )}
      {/* Selection halo */}
      {selected && (
        <path d={d} fill="none" stroke="#6366f1" strokeOpacity={0.25} strokeWidth={w + 8} strokeLinecap="round" style={{ pointerEvents: 'none' }} />
      )}
      {/* Wide invisible hit-area */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(16, w + 12)}
        style={{ pointerEvents: interactive ? 'stroke' : 'none', cursor: interactive ? 'pointer' : 'default' }}
        onMouseDown={(e) => { if (interactive) { e.stopPropagation(); onSelect?.(conn.id) } }}
      />
      {/* Visible line — butt cap when arrows are present so no round cap bleeds past the marker tip */}
      <path
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={w}
        strokeLinecap={hasStart || hasEnd ? 'butt' : 'round'}
        strokeLinejoin="round"
        strokeDasharray={conn.dashed ? `${Math.max(6, w * 3)} ${Math.max(4, w * 2)}` : undefined}
        markerEnd={hasEnd   ? `url(#${endId})`   : undefined}
        markerStart={hasStart ? `url(#${startId})` : undefined}
        style={{ pointerEvents: 'none' }}
      />

      {/* Label */}
      {conn.label && (
        <g style={{ pointerEvents: interactive ? 'all' : 'none', cursor: interactive ? 'pointer' : 'default' }} onMouseDown={(e) => { if (interactive) { e.stopPropagation(); onSelect?.(conn.id) } }}>
          <rect
            x={mid.x - conn.label.length * 3.6 - 6}
            y={mid.y - 10}
            width={conn.label.length * 7.2 + 12}
            height={20}
            rx={6}
            fill="white"
            stroke={selected ? '#6366f1' : '#e5e7eb'}
          />
          <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize={12} fill="#374151" style={{ userSelect: 'none' }}>
            {conn.label}
          </text>
        </g>
      )}
    </g>
  )
}
