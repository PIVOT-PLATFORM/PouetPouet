// Converts a Klaxoon _brainstorm_data.json to PouetPouet card + connection lists.
// Pure function — no I/O, no side effects.

const POSTIT_BASE = 192  // Klaxoon default postit size at scale=1 (px)
const DRAW_PAD    = 8    // padding inside DRAW card bounding box

// Best-effort mapping for Klaxoon's c{n} CSS variables (no official source).
const C_MAP: Record<string, string> = {
  c1: '#1a1a1a', c2: '#ffffff', c3: '#ef4444', c4: '#f97316',
  c5: '#eab308', c6: '#22c55e', c7: '#0ea5e9', c8: '#6366f1',
  c9: '#ec4899', c10: '#f59e0b', c11: '#10b981', c12: '#3b82f6',
  c13: '#8b5cf6', c14: '#e11d48', c15: '#64748b', c16: '#374151',
  c17: '#9ca3af', c18: '#6b7280', c19: '#d1d5db', c20: '#f3f4f6',
  c51: '#6366f1',
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

interface PathCmd {
  type: number
  x?: number; y?: number
  x1?: number; y1?: number
  x2?: number; y2?: number
}

function getPathBbox(raw: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let cmds: PathCmd[]
  try { cmds = JSON.parse(raw) } catch { return null }
  const xs: number[] = [], ys: number[] = []
  for (const c of cmds) {
    if (c.type === 2 || c.type === 32) {
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

function generatePathD(raw: string, tx: number, ty: number): string {
  let cmds: PathCmd[]
  try { cmds = JSON.parse(raw) } catch { return '' }
  let d = ''
  for (const c of cmds) {
    if (c.type === 2 && c.x !== undefined && c.y !== undefined) {
      d += `M${(c.x + tx).toFixed(1)},${(c.y + ty).toFixed(1)} `
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

export interface KlxCard {
  klxId: string
  type: 'TEXT' | 'LABEL' | 'DRAW' | 'IMAGE'
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

export interface KlxImportStats {
  postits: number
  texts: number
  draws: number
  images: number
  links: number
  groups: number
  skipped: number
}

export interface KlxImportResult {
  cards: KlxCard[]
  connections: KlxConnection[]
  stats: KlxImportStats
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function convertKlaxoon(data: any, imageMap?: Map<string, string>): KlxImportResult {
  const colorMap = new Map<string, string>()
  for (const c of data.colors ?? []) colorMap.set(c.id, c.hexa)

  const cards: KlxCard[] = []
  const connections: KlxConnection[] = []
  const stats: KlxImportStats = { postits: 0, texts: 0, draws: 0, images: 0, links: 0, groups: 0, skipped: 0 }

  // --- Global offset: shift everything so top-left starts near (0, 0) ---
  let minX = Infinity, minY = Infinity
  for (const idea of data.ideas ?? []) {
    minX = Math.min(minX, idea.coords?.left ?? 0)
    minY = Math.min(minY, idea.coords?.top ?? 0)
  }
  for (const item of data.state ?? []) {
    if (item.board_object_type === 'text') {
      minX = Math.min(minX, item.coords?.left ?? 0)
      minY = Math.min(minY, item.coords?.top ?? 0)
    } else if (item.board_object_type === 'pen' && item.path_commands) {
      const bbox = getPathBbox(item.path_commands)
      if (bbox) { minX = Math.min(minX, bbox.minX); minY = Math.min(minY, bbox.minY) }
    }
  }
  if (!isFinite(minX)) minX = 0
  if (!isFinite(minY)) minY = 0

  const ox = minX - 40  // 40px margin from origin
  const oy = minY - 40

  // --- Ideas (postits) → TEXT cards ---
  for (const idea of data.ideas ?? []) {
    if (!idea.is_active) { stats.skipped++; continue }

    const color = colorMap.get(idea.color?.id) ?? '#FFEB3B'
    const text = idea.content_html ? stripHtml(idea.content_html) : (idea.text ?? '')
    const scaleX = idea.scale?.scale_x ?? 1
    const scaleY = idea.scale?.scale_y ?? 1

    cards.push({
      klxId: idea.uuid,
      type: 'TEXT',
      content: text,
      color,
      posX: Math.round((idea.coords?.left ?? 0) - ox),
      posY: Math.round((idea.coords?.top ?? 0) - oy),
      width:  Math.max(150, Math.round(POSTIT_BASE * scaleX)),
      height: Math.max(110, Math.round(POSTIT_BASE * scaleY)),
      zIndex: idea.z_index ?? 0,
      locked: idea.is_locked ?? false,
      groupKey: null,
    })
    stats.postits++
  }

  // --- State items ---
  for (const item of data.state ?? []) {
    if (!item.is_active) { stats.skipped++; continue }

    if (item.board_object_type === 'text') {
      const text = item.text ?? (item.content_html ? stripHtml(item.content_html) : '')
      const scaleX = item.scale?.scale_x ?? 1
      const w = Math.max(80, Math.round((item.content_width ?? 160) * scaleX))

      cards.push({
        klxId: item.uuid,
        type: 'LABEL',
        content: JSON.stringify({ text, size: 20, bold: false, italic: false, underline: false, strike: false, color: '#374151' }),
        color: '#374151',
        posX: Math.round((item.coords?.left ?? 0) - ox),
        posY: Math.round((item.coords?.top ?? 0) - oy),
        width: w,
        height: 56,
        zIndex: item.z_index ?? 0,
        locked: item.is_locked ?? false,
        groupKey: null,
      })
      stats.texts++

    } else if (item.board_object_type === 'pen' && item.path_commands) {
      const bbox = getPathBbox(item.path_commands)
      if (!bbox) { stats.skipped++; continue }

      const cardX = Math.round(bbox.minX - ox - DRAW_PAD)
      const cardY = Math.round(bbox.minY - oy - DRAW_PAD)
      const cardW = Math.max(80, Math.round(bbox.maxX - bbox.minX + DRAW_PAD * 2))
      const cardH = Math.max(80, Math.round(bbox.maxY - bbox.minY + DRAW_PAD * 2))
      const d = generatePathD(item.path_commands, DRAW_PAD - bbox.minX, DRAW_PAD - bbox.minY)

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

    } else if (item.board_object_type === 'imageboard' && item.path && imageMap) {
      const dataUrl = imageMap.get(item.path)
      if (!dataUrl) { stats.skipped++; continue }

      const scaleX = item.scale?.scale_x ?? 1
      const scaleY = item.scale?.scale_y ?? 1
      const MAX_W = 1200, MAX_H = 900
      const naturalW = (item.width ?? 200) * scaleX
      const naturalH = (item.height ?? 150) * scaleY
      const ratio = Math.min(MAX_W / naturalW, MAX_H / naturalH, 1)
      const cardW = Math.max(80, Math.round(naturalW * ratio))
      const cardH = Math.max(60, Math.round(naturalH * ratio))

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

    } else {
      stats.skipped++  // imageboard without map, or unknown types
    }
  }

  // --- Links → Connections ---
  const linkShapeMap: Record<string, KlxConnection['shape']> = {
    curve: 'curved', straight: 'straight', orthogonal: 'orthogonal',
  }

  for (const link of data.links ?? []) {
    if (!link.is_active) { stats.skipped++; continue }
    const [fromId, toId] = link.object_ids ?? []
    if (!fromId || !toId) { stats.skipped++; continue }

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

  return { cards, connections, stats }
}
