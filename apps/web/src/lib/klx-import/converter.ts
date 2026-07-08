// Converts a Klaxoon _brainstorm_data.json to PouetPouet card + connection +
// frame lists. Pure function — no I/O, no side effects.

const DRAW_PAD = 8       // padding inside DRAW card bounding box
const KLX_POSTIT = 192   // Klaxoon postit base width at scale 1 (confirmed by
                         // grid spacing measured across several real exports)

// Height a TEXT card needs for its content at the given width. Metrics match
// the board card: 14px font ≈ 7.8px/char, line-height ≈ 23px, 28px header.
function fitTextHeight(text: string, width: number): number {
  const charsPerLine = Math.max(4, Math.floor((width - 24) / 7.8))
  let lines = 0
  for (const line of text.split('\n')) {
    lines += Math.max(1, Math.ceil(line.length / charsPerLine))
  }
  return 40 + lines * 23
}

// Best-effort mapping for Klaxoon's c{n} CSS variables (no official source).
const C_MAP: Record<string, string> = {
  c1: '#1a1a1a', c2: '#ffffff', c3: '#ef4444', c4: '#f97316',
  c5: '#eab308', c6: '#22c55e', c7: '#0ea5e9', c8: '#6366f1',
  c9: '#ec4899', c10: '#f59e0b', c11: '#10b981', c12: '#3b82f6',
  c13: '#8b5cf6', c14: '#e11d48', c15: '#64748b', c16: '#374151',
  c17: '#9ca3af', c18: '#6b7280', c19: '#d1d5db', c20: '#f3f4f6',
  c38: '#5bc2e7', c51: '#6366f1', c52: '#eef2ff',
}
function cColor(code: string): string {
  return C_MAP[code] ?? '#9ca3af'
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .trim()
}

// The effective font-size / weight / color of a Klaxoon text live as inline
// styles in content_html (the font_size field, when present, is stale).
// Rich titles carry one span per colored letter — take the max size, and the
// most frequent color (a single white letter must not turn the label white).
function parseHtmlStyle(html: string): { size: number | null; bold: boolean; color: string | null } {
  let size: number | null = null
  for (const m of html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)(px|rem|em)/g)) {
    const px = parseFloat(m[1]) * (m[2] === 'px' ? 1 : 16)
    if (size === null || px > size) size = px
  }
  const colorVotes = new Map<string, number>()
  for (const m of html.matchAll(/color:\s*var\(--(c\d+)\)/g)) {
    colorVotes.set(m[1], (colorVotes.get(m[1]) ?? 0) + 1)
  }
  let color: string | null = null
  let best = 0
  for (const [code, count] of colorVotes) {
    if (count > best) { best = count; color = cColor(code) }
  }
  return {
    size,
    bold: /<strong[\s>]|font-weight:\s*(?:bold|[6-9]00)/.test(html),
    color,
  }
}

interface PathCmd {
  type: number
  x?: number; y?: number
  x1?: number; y1?: number
  x2?: number; y2?: number
}

// Klaxoon path command types: 2 = moveTo, 16 = lineTo, 32 = bezierCurveTo, 1 = closePath
function parseCmds(raw: string): PathCmd[] | null {
  try {
    const cmds = JSON.parse(raw)
    return Array.isArray(cmds) ? cmds : null
  } catch { return null }
}

function cmdsBbox(cmds: PathCmd[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const xs: number[] = [], ys: number[] = []
  for (const c of cmds) {
    if (c.type === 2 || c.type === 16 || c.type === 32) {
      if (c.x !== undefined) xs.push(c.x)
      if (c.y !== undefined) ys.push(c.y)
      if (c.type === 32) {
        if (c.x1 !== undefined) xs.push(c.x1)
        if (c.y1 !== undefined) ys.push(c.y1)
        if (c.x2 !== undefined) xs.push(c.x2)
        if (c.y2 !== undefined) ys.push(c.y2)
      }
    }
  }
  if (xs.length === 0) return null
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

// Rotates path points around the path bbox center. Klaxoon stores the unrotated
// path + an `angle` in degrees (CSS convention: positive = clockwise, y down).
function rotateCmds(cmds: PathCmd[], angleDeg: number): PathCmd[] {
  const bbox = cmdsBbox(cmds)
  if (!bbox) return cmds
  const cx = (bbox.minX + bbox.maxX) / 2
  const cy = (bbox.minY + bbox.maxY) / 2
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)
  const rot = (x: number, y: number): [number, number] => [
    cx + (x - cx) * cos - (y - cy) * sin,
    cy + (x - cx) * sin + (y - cy) * cos,
  ]
  return cmds.map((c) => {
    const next: PathCmd = { ...c }
    if (c.x !== undefined && c.y !== undefined) [next.x, next.y] = rot(c.x, c.y)
    if (c.x1 !== undefined && c.y1 !== undefined) [next.x1, next.y1] = rot(c.x1, c.y1)
    if (c.x2 !== undefined && c.y2 !== undefined) [next.x2, next.y2] = rot(c.x2, c.y2)
    return next
  })
}

function buildD(cmds: PathCmd[], tx: number, ty: number): string {
  let d = ''
  for (const c of cmds) {
    if (c.type === 2 && c.x !== undefined && c.y !== undefined) {
      d += `M${(c.x + tx).toFixed(1)},${(c.y + ty).toFixed(1)} `
    } else if (c.type === 16 && c.x !== undefined && c.y !== undefined) {
      d += `L${(c.x + tx).toFixed(1)},${(c.y + ty).toFixed(1)} `
    } else if (c.type === 32 && c.x !== undefined && c.y !== undefined) {
      d += `C${((c.x1 ?? c.x) + tx).toFixed(1)},${((c.y1 ?? c.y) + ty).toFixed(1)} `
      d += `${((c.x2 ?? c.x) + tx).toFixed(1)},${((c.y2 ?? c.y) + ty).toFixed(1)} `
      d += `${(c.x + tx).toFixed(1)},${(c.y + ty).toFixed(1)} `
    } else if (c.type === 1) {
      d += 'Z '
    }
  }
  return d.trim()
}

// On-path points (segment endpoints, translated) — used to place arrowheads.
function pathPoints(cmds: PathCmd[], tx: number, ty: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  for (const c of cmds) {
    if ((c.type === 2 || c.type === 16 || c.type === 32) && c.x !== undefined && c.y !== undefined) {
      pts.push({ x: c.x + tx, y: c.y + ty })
    }
  }
  return pts
}

// Two barbs forming an open arrowhead at `tip`, coming from `approach`.
function arrowheadD(tip: { x: number; y: number }, approach: { x: number; y: number }, size: number): string {
  const dx = tip.x - approach.x, dy = tip.y - approach.y
  const len = Math.hypot(dx, dy)
  if (len < 0.01) return ''
  const ux = dx / len, uy = dy / len
  const barb = (sign: number): [number, number] => {
    const a = (sign * 28 * Math.PI) / 180
    const cos = Math.cos(a), sin = Math.sin(a)
    // direction pointing back from the tip, rotated ±28°
    const bx = -(ux * cos - uy * sin), by = -(ux * sin + uy * cos)
    return [tip.x + bx * size, tip.y + by * size]
  }
  const [lx, ly] = barb(1)
  const [rx, ry] = barb(-1)
  return ` M${lx.toFixed(1)},${ly.toFixed(1)} L${tip.x.toFixed(1)},${tip.y.toFixed(1)} L${rx.toFixed(1)},${ry.toFixed(1)}`
}

// Detects an axis-aligned rectangle: moveTo + 4 lineTo closing back on the start
// point, each segment strictly horizontal or vertical. Klaxoon's shape tool
// emits rectangles this way; freehand strokes use bezier commands instead.
function detectRect(raw: string): { x: number; y: number; w: number; h: number } | null {
  const cmds = parseCmds(raw)
  if (!cmds) return null
  if (cmds.length !== 6 || cmds[0].type !== 2 || cmds[5].type !== 1) return null
  const pts = cmds.slice(0, 5)
  if (pts.some((c, i) => (i > 0 && c.type !== 16) || c.x === undefined || c.y === undefined)) return null
  const eps = 0.01
  if (Math.abs(pts[0].x! - pts[4].x!) > eps || Math.abs(pts[0].y! - pts[4].y!) > eps) return null
  for (let i = 0; i < 4; i++) {
    const dx = Math.abs(pts[i + 1].x! - pts[i].x!)
    const dy = Math.abs(pts[i + 1].y! - pts[i].y!)
    if (dx > eps && dy > eps) return null
  }
  const xs = pts.map((c) => c.x!), ys = pts.map((c) => c.y!)
  const x = Math.min(...xs), y = Math.min(...ys)
  const w = Math.max(...xs) - x, h = Math.max(...ys) - y
  if (w < eps || h < eps) return null
  return { x, y, w, h }
}

export interface KlxCard {
  klxId: string
  type: 'TEXT' | 'LABEL' | 'DRAW' | 'IMAGE' | 'SHAPE'
  content: string
  color: string
  posX: number
  posY: number
  width: number
  height: number
  zIndex: number
  locked: boolean
  // Klaxoon group uuid this card belongs to (null = ungrouped). The API remaps
  // each distinct key to a fresh server-side groupId on import.
  groupKey: string | null
  // Structured metadata (postit category, dimension values) → board custom
  // fields; `field` is the field name declared in KlxImportResult.fields.
  fieldValues?: { field: string; value: string }[]
}

// Klaxoon postit categories / dimensions → board custom fields.
export interface KlxField {
  name: string
  type: 'TEXT' | 'SELECT'
  options: string[] | null
}

export interface KlxConnection {
  fromKlxId: string
  toKlxId: string
  shape: 'curved' | 'straight' | 'orthogonal'
  color: string
  width: number
  dashed: boolean
  arrow: 'none' | 'start' | 'end' | 'both'
  label: string
}

// Klaxoon "zone" → board Frame (titled area).
export interface KlxFrame {
  title: string
  posX: number
  posY: number
  width: number
  height: number
}

export interface KlxImportStats {
  postits: number
  texts: number
  draws: number
  shapes: number
  images: number
  links: number
  groups: number
  zones: number
  fields: number
  skipped: number
}

export interface KlxImportResult {
  cards: KlxCard[]
  connections: KlxConnection[]
  frames: KlxFrame[]
  fields: KlxField[]
  stats: KlxImportStats
  // Unknown board_object_types encountered during import (one sample per type).
  // Populated only when debug=true is passed. Used to identify new Klaxoon types.
  unknownTypes?: Record<string, unknown>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertKlaxoon(data: any, imageMap?: Map<string, string>, debug = false): KlxImportResult {
  const colorMap = new Map<string, string>()
  for (const c of data.colors ?? []) colorMap.set(c.id, c.hexa)

  const cards: KlxCard[] = []
  const connections: KlxConnection[] = []
  const frames: KlxFrame[] = []
  const stats: KlxImportStats = { postits: 0, texts: 0, draws: 0, shapes: 0, images: 0, links: 0, groups: 0, zones: 0, fields: 0, skipped: 0 }
  const unknownTypes: Record<string, unknown> = {}

  // Postit categories (color-legend labels) and dimensions (structured extra
  // columns like « Porteur ») referenced by ideas — become board custom fields.
  const categoryLabels = new Map<string, string>()
  for (const cat of data.categories ?? []) {
    if (cat?.id !== undefined && cat.label) categoryLabels.set(String(cat.id), String(cat.label))
  }
  const dimensionLabels = new Map<string, string>()
  for (const dim of data.dimensions ?? []) {
    if (dim?.uuid && dim.label) dimensionLabels.set(dim.uuid, String(dim.label))
  }

  // --- Global offset: shift everything so top-left starts near (0, 0) ---
  let minX = Infinity, minY = Infinity
  for (const idea of data.ideas ?? []) {
    minX = Math.min(minX, idea.coords?.left ?? 0)
    minY = Math.min(minY, idea.coords?.top ?? 0)
  }
  for (const item of data.state ?? []) {
    // Pens/brushes included: their coords (not path data) hold the board
    // position — path coordinates live in a local drawing space. Zones frame
    // the whole board and often define its true top-left corner.
    const t = item.board_object_type
    if (t === 'text' || t === 'pen' || t === 'brush' || t === 'imageboard' || t === 'zone') {
      minX = Math.min(minX, item.coords?.left ?? 0)
      minY = Math.min(minY, item.coords?.top ?? 0)
    }
  }
  if (!isFinite(minX)) minX = 0
  if (!isFinite(minY)) minY = 0

  const ox = minX - 40  // 40px margin from origin
  const oy = minY - 40

  // --- Ideas (postits) → TEXT / IMAGE cards ---
  // Klaxoon renders a postit at 192px × scale; reusing that geometry (instead
  // of refitting to the text) keeps the original layout: grids stay grids,
  // shrunk postits stay small, enlarged ones stay big.
  for (const idea of data.ideas ?? []) {
    if (!idea.is_active) { stats.skipped++; continue }

    const scale = idea.scale?.scale_x ?? 1
    const width = Math.max(24, Math.round(KLX_POSTIT * scale))
    const posX = Math.round((idea.coords?.left ?? 0) - ox)
    const posY = Math.round((idea.coords?.top ?? 0) - oy)

    const fieldValues: { field: string; value: string }[] = []
    const categoryLabel = idea.category?.id ? categoryLabels.get(String(idea.category.id)) : undefined
    if (categoryLabel) fieldValues.push({ field: 'Catégorie', value: categoryLabel })
    for (const dv of idea.dimension_values ?? []) {
      const label = dv?.dimension?.uuid ? dimensionLabels.get(dv.dimension.uuid) : undefined
      const value = typeof dv?.value === 'string' ? dv.value.trim() : ''
      if (label && value) fieldValues.push({ field: label, value })
    }
    const withFields = fieldValues.length > 0 ? { fieldValues } : {}

    // Image postit (idea.type IMAGE): the postit body is a mediabundle image.
    if (idea.type?.type === 'IMAGE' && idea.image?.path) {
      const dataUrl = imageMap?.get(idea.image.path)
      if (!dataUrl) { stats.skipped++; continue }
      const ratio = idea.image.width > 0 ? idea.image.height / idea.image.width : 1
      cards.push({
        klxId: idea.uuid,
        type: 'IMAGE',
        content: dataUrl,
        color: 'transparent',
        posX, posY,
        width,
        height: Math.max(24, Math.round(width * ratio)),
        zIndex: idea.z_index ?? 0,
        locked: idea.is_locked ?? false,
        groupKey: null,
        ...withFields,
      })
      stats.images++
      continue
    }

    const color = colorMap.get(idea.color?.id) ?? '#FFEB3B'
    const text = idea.content_html ? stripHtml(idea.content_html) : (idea.text ?? '')
    // format 'square' = fixed square; 'auto' = height follows the content.
    // Klaxoon wraps the text at the base width (192px) then scales the whole
    // postit — so the height is the base content height × scale, capped ×3.
    const height = idea.format === 'square'
      ? width
      : Math.min(Math.round(fitTextHeight(text, KLX_POSTIT) * scale), width * 3)

    cards.push({
      klxId: idea.uuid,
      type: 'TEXT',
      content: text,
      color,
      posX, posY,
      width,
      height,
      zIndex: idea.z_index ?? 0,
      locked: idea.is_locked ?? false,
      groupKey: null,
      ...withFields,
    })
    stats.postits++
  }

  // --- State items ---
  for (const item of data.state ?? []) {
    if (!item.is_active) { stats.skipped++; continue }

    if (item.board_object_type === 'zone') {
      // Zones are Klaxoon's titled areas structuring the board → board Frames.
      frames.push({
        title: (item.title ?? '').trim() || 'Zone',
        posX: Math.round((item.coords?.left ?? 0) - ox),
        posY: Math.round((item.coords?.top ?? 0) - oy),
        width: Math.max(100, Math.round(item.width ?? 400)),
        height: Math.max(100, Math.round(item.height ?? 300)),
      })
      stats.zones++

    } else if (item.board_object_type === 'text') {
      const html = item.content_html ?? ''
      const style = parseHtmlStyle(html)
      const text = item.text ?? stripHtml(html)
      const scaleX = item.scale?.scale_x ?? 1
      // The effective size is the inline font-size of content_html (default
      // 16px) multiplied by the scale handles — no artificial cap: Klaxoon
      // boards legitimately carry 150px+ section titles.
      const size = Math.min(400, Math.max(8, Math.round((style.size ?? 16) * scaleX)))
      const lines = text.split('\n')
      const maxLine = Math.max(1, ...lines.map((l: string) => l.length))
      const w = item.content_width
        ? Math.max(80, Math.round(item.content_width * scaleX))
        : Math.max(80, Math.round(maxLine * size * 0.6) + 24)
      const color = style.color ?? '#374151'

      cards.push({
        klxId: item.uuid,
        type: 'LABEL',
        content: JSON.stringify({ text, size, bold: style.bold, italic: false, underline: false, strike: false, color }),
        color,
        posX: Math.round((item.coords?.left ?? 0) - ox),
        posY: Math.round((item.coords?.top ?? 0) - oy),
        width: w,
        height: Math.max(40, Math.round(lines.length * size * 1.5)),
        zIndex: item.z_index ?? 0,
        locked: item.is_locked ?? false,
        groupKey: null,
      })
      stats.texts++

    } else if (item.board_object_type === 'pen' && item.path_commands) {
      // Pen position comes from coords (board space); path_commands coordinates
      // live in a local drawing space — the same path is reused verbatim when a
      // drawing is duplicated. The path bbox only provides the size.
      const px = item.coords?.left
      const py = item.coords?.top
      const angle = item.angle ?? 0

      let cmds = parseCmds(item.path_commands)
      if (!cmds) { stats.skipped++; continue }

      // Shape-tool rectangles become native SHAPE cards (editable, resizable).
      // Recent exports flag them via shape_type; older ones need geometric
      // detection. Rotated ones keep the DRAW path since SHAPE rects can't rotate.
      let rect = !angle ? detectRect(item.path_commands) : null
      if (!rect && !angle && item.shape_type === 'rectangle') {
        const bb = cmdsBbox(cmds)
        if (bb) rect = { x: bb.minX, y: bb.minY, w: bb.maxX - bb.minX, h: bb.maxY - bb.minY }
      }
      if (rect) {
        const sw = item.stroke_width ?? 4
        const strokeSize = sw <= 2 ? 'thin' : sw >= 6 ? 'thick' : 'medium'
        const hasFill = !!item.fill_color
        const fillOpacity = item.fill_color_opacity ?? 1
        // PouetPouet shapes have a single color for stroke + fill. When the
        // Klaxoon rect is filled, the fill is the dominant visual — use it.
        const color = hasFill ? cColor(item.fill_color)
          : item.color ? cColor(item.color) : '#374151'

        cards.push({
          klxId: item.uuid,
          type: 'SHAPE',
          content: `rect|${strokeSize}|${hasFill}|${fillOpacity}`,
          color,
          // coords anchors the path's local origin (0,0) — a shape drawn
          // bottom-right → top-left has a negative local min to add back.
          posX: Math.round((px !== undefined ? px + rect.x : rect.x) - ox),
          posY: Math.round((py !== undefined ? py + rect.y : rect.y) - oy),
          width: Math.max(20, Math.round(rect.w)),
          height: Math.max(20, Math.round(rect.h)),
          zIndex: item.z_index ?? 0,
          locked: item.is_locked ?? false,
          groupKey: null,
        })
        stats.shapes++
        continue
      }

      if (angle) cmds = rotateCmds(cmds, angle)
      const bbox = cmdsBbox(cmds)
      if (!bbox) { stats.skipped++; continue }

      // Same anchoring rule: board top-left = coords + local bbox min (the
      // path may extend into negative local space when drawn right-to-left).
      const cardX = Math.round((px !== undefined ? px + bbox.minX : bbox.minX) - ox - DRAW_PAD)
      const cardY = Math.round((py !== undefined ? py + bbox.minY : bbox.minY) - oy - DRAW_PAD)
      const cardW = Math.max(80, Math.round(bbox.maxX - bbox.minX + DRAW_PAD * 2))
      const cardH = Math.max(80, Math.round(bbox.maxY - bbox.minY + DRAW_PAD * 2))
      const tx = DRAW_PAD - bbox.minX, ty = DRAW_PAD - bbox.minY
      let d = buildD(cmds, tx, ty)

      // Klaxoon straight-line "pens" carry arrow endpoints via end_shapes
      // ('a' = arrow, 'l' = plain). Draw the heads into the path itself.
      const ends: string[] = item.end_shapes ?? []
      if (ends.includes('a')) {
        const pts = pathPoints(cmds, tx, ty)
        if (pts.length >= 2) {
          const size = Math.max(12, (item.stroke_width ?? 4) * 3)
          if (ends[0] === 'a') d += arrowheadD(pts[0], pts[1], size)
          if (ends[1] === 'a') d += arrowheadD(pts[pts.length - 1], pts[pts.length - 2], size)
        }
      }

      cards.push({
        klxId: item.uuid,
        type: 'DRAW',
        content: d,
        color: item.color ? cColor(item.color) : '#374151',
        posX: cardX,
        posY: cardY,
        width: cardW,
        height: cardH,
        zIndex: item.z_index ?? 0,
        locked: item.is_locked ?? false,
        groupKey: null,
      })
      stats.draws++

    } else if (item.board_object_type === 'brush' && Array.isArray(item.path)) {
      // Highlighter stroke: path = ["simple", [w, h], [[dx, dy], …]] where the
      // points are relative to the bbox center and coords is the top-left.
      const dims = item.path[1]
      const deltas = item.path[2]
      if (!Array.isArray(dims) || dims.length < 2 || !Array.isArray(deltas) || deltas.length === 0) {
        stats.skipped++
        continue
      }
      const sx = item.scale?.scale_x ?? 1
      const sy = item.scale?.scale_y ?? 1
      const pts = deltas
        .filter((p: unknown): p is [number, number] => Array.isArray(p) && p.length >= 2)
        .map(([dx, dy]: [number, number]) => ({
          x: (dims[0] / 2 + dx) * sx + DRAW_PAD,
          y: (dims[1] / 2 + dy) * sy + DRAW_PAD,
        }))
      if (pts.length === 0) { stats.skipped++; continue }
      const d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} ` + pts.slice(1).map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

      cards.push({
        klxId: item.uuid,
        type: 'DRAW',
        content: d.trim(),
        color: item.color ? cColor(item.color) : '#374151',
        posX: Math.round((item.coords?.left ?? 0) - ox - DRAW_PAD),
        posY: Math.round((item.coords?.top ?? 0) - oy - DRAW_PAD),
        width: Math.max(24, Math.round(dims[0] * sx + DRAW_PAD * 2)),
        height: Math.max(24, Math.round(dims[1] * sy + DRAW_PAD * 2)),
        zIndex: item.z_index ?? 0,
        locked: item.is_locked ?? false,
        groupKey: null,
      })
      stats.draws++

    } else if (item.board_object_type === 'imageboard' && item.path && imageMap) {
      const dataUrl = imageMap.get(item.path)
      if (!dataUrl) { stats.skipped++; continue }

      const scaleX = item.scale?.scale_x ?? 1
      const scaleY = item.scale?.scale_y ?? 1
      // True display size = natural size × scale. No cap: huge screenshots are
      // often the visual backdrop the rest of the board is laid out on —
      // shrinking them would break every surrounding position.
      const cardW = Math.max(24, Math.round((item.width ?? 200) * scaleX))
      const cardH = Math.max(24, Math.round((item.height ?? 150) * scaleY))

      cards.push({
        klxId: item.uuid,
        type: 'IMAGE',
        content: dataUrl,
        color: 'transparent',
        posX: Math.round((item.coords?.left ?? 0) - ox),
        posY: Math.round((item.coords?.top ?? 0) - oy),
        width: cardW,
        height: cardH,
        zIndex: item.z_index ?? 0,
        locked: item.is_locked ?? false,
        groupKey: null,
      })
      stats.images++

    } else if (item.board_object_type === 'postitcolorlegend') {
      // Board-level legend widget, not a content object.
      stats.skipped++

    } else {
      stats.skipped++
      if (debug && item.board_object_type && !unknownTypes[item.board_object_type]) {
        unknownTypes[item.board_object_type] = item
      }
    }
  }

  // --- Links → Connections ---
  const linkShapeMap: Record<string, KlxConnection['shape']> = {
    curve: 'curved', straight: 'straight', orthogonal: 'orthogonal',
  }
  const cardIds = new Set(cards.map((c) => c.klxId))

  for (const link of data.links ?? []) {
    if (!link.is_active) { stats.skipped++; continue }
    const [fromId, toId] = link.object_ids ?? []
    if (!fromId || !toId) { stats.skipped++; continue }
    // Links pointing at deleted or non-imported objects would be silently
    // dropped by the API — skip them here so the preview count is honest.
    if (!cardIds.has(fromId) || !cardIds.has(toId)) { stats.skipped++; continue }

    const s0 = link.shapes?.[0] === 'a'
    const s1 = link.shapes?.[1] === 'a'
    const arrow: KlxConnection['arrow'] = s0 && s1 ? 'both' : s0 ? 'start' : s1 ? 'end' : 'none'

    connections.push({
      fromKlxId: fromId,
      toKlxId: toId,
      shape: linkShapeMap[link.link_shape] ?? 'curved',
      color: link.color ? cColor(link.color) : '#9ca3af',
      width: Math.max(1, Math.round((link.stroke_width ?? 4) / 2)),
      dashed: link.stroke_style === 'dashed',
      arrow,
      label: '',
    })
    stats.links++
  }

  // --- Stacking order ---
  // The board renders cards in creation order (no per-card z-index server side),
  // and the API creates them in array order. Sort by Klaxoon z_index so big
  // container shapes (low z) end up below the postits they frame.
  cards.sort((a, b) => a.zIndex - b.zIndex)

  // --- Groups → shared groupKey ---
  // Tag each group's imported members with the Klaxoon group uuid. Only groups
  // that keep at least 2 imported members are materialized: a lone member would
  // be auto-dissolved by the app anyway. First-wins on overlap, since a card can
  // hold only one group.
  const byKlxId = new Map<string, KlxCard>()
  for (const c of cards) byKlxId.set(c.klxId, c)

  for (const group of data.groups ?? []) {
    const members = (group.object_ids ?? [])
      .map((oid: string) => byKlxId.get(oid))
      .filter((c: KlxCard | undefined): c is KlxCard => !!c && c.groupKey === null)
    if (members.length < 2) continue
    for (const c of members) c.groupKey = group.uuid
    stats.groups++
  }

  // --- Custom fields ---
  // Only declare the fields at least one imported card actually uses.
  const usedFieldNames = new Set<string>()
  for (const c of cards) {
    for (const fv of c.fieldValues ?? []) usedFieldNames.add(fv.field)
  }
  const fields: KlxField[] = []
  if (usedFieldNames.has('Catégorie')) {
    fields.push({ name: 'Catégorie', type: 'SELECT', options: [...new Set(categoryLabels.values())] })
  }
  for (const label of new Set(dimensionLabels.values())) {
    if (usedFieldNames.has(label) && label !== 'Catégorie') {
      fields.push({ name: label, type: 'TEXT', options: null })
    }
  }
  stats.fields = fields.length

  if (debug && Object.keys(unknownTypes).length > 0) {
    console.info('[klx-import] unknown types (one sample each):', unknownTypes)
  }

  return { cards, connections, frames, fields, stats, ...(debug ? { unknownTypes } : {}) }
}
