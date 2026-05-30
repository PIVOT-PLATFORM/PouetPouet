// Single source of truth for the colors offered across the app (cards, shapes,
// labels, teams…). Quick-pick swatches everywhere use BASE_COLORS; anything beyond
// is available through the custom picker, and recent custom colors are remembered.

// Softened pastel palette (≈ Tailwind 300 level) — gentle on the eyes for cards,
// shapes and labels alike, plus neutrals for text.
export const BASE_COLORS = [
  '#FCA5A5', // red
  '#FDBA74', // orange
  '#FCD34D', // amber
  '#FEF08A', // yellow
  '#86EFAC', // green
  '#5EEAD4', // teal
  '#7DD3FC', // sky
  '#93C5FD', // blue
  '#A5B4FC', // indigo
  '#C4B5FD', // violet
  '#F9A8D4', // pink
  '#CBD5E1', // soft gray
  '#111827', // near-black
  '#FFFFFF', // white
] as const

// Sensible defaults drawn from the shared palette.
export const DEFAULT_CARD_COLOR = '#FEF08A'   // soft yellow — new sticky notes
export const DEFAULT_SHAPE_COLOR = '#A5B4FC'  // soft indigo — new shapes / drawings
export const DEFAULT_LABEL_COLOR = '#111827'  // near-black — label text

// ── Recently used custom colors (localStorage) ────────────────────────────────
const RECENTS_KEY = 'pp-recent-colors'
const RECENTS_MAX = 8

function isHex(c: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)
}

export function getRecentColors(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((c) => typeof c === 'string' && isHex(c)).slice(0, RECENTS_MAX) : []
  } catch {
    return []
  }
}

// Records a custom color (skips ones already in the base palette). Returns the new list.
export function pushRecentColor(color: string): string[] {
  if (typeof window === 'undefined' || !isHex(color)) return []
  const norm = color.toLowerCase()
  if ((BASE_COLORS as readonly string[]).map((c) => c.toLowerCase()).includes(norm)) return getRecentColors()
  const next = [norm, ...getRecentColors().filter((c) => c.toLowerCase() !== norm)].slice(0, RECENTS_MAX)
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)) } catch {}
  return next
}
