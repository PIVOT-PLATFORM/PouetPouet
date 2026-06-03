// A card LABEL stores its rich-text formatting as JSON; legacy/plain labels are raw text.
export interface LabelFmt {
  text: string
  size: number
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  color: string
}

const LABEL_DEFAULTS: LabelFmt = {
  text: '', size: 16, bold: false, italic: false, underline: false, strike: false, color: '#374151',
}

// Parses a label's stored content, falling back to treating the raw string as plain text.
export function parseLabelFmt(raw: string): LabelFmt {
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object' && 'text' in p) return { ...LABEL_DEFAULTS, ...p }
  } catch {}
  return { ...LABEL_DEFAULTS, text: raw }
}

// A TEXT card stores its rich-text formatting as JSON; legacy/plain cards are raw text.
export type TextAlign = 'left' | 'center' | 'right'
export interface TextFmt {
  text: string
  size: number
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  color: string
  align: TextAlign
}

const TEXT_DEFAULTS: TextFmt = {
  text: '', size: 14, bold: false, italic: false, underline: false, strike: false, color: '#1f2937', align: 'left',
}

// Parses a TEXT card's stored content, falling back to treating the raw string as plain text.
export function parseTextFmt(raw: string): TextFmt {
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object' && 'text' in p) return { ...TEXT_DEFAULTS, ...p }
  } catch {}
  return { ...TEXT_DEFAULTS, text: raw }
}

// Serializes a TEXT card's content: plain text when unformatted (keeps it human-readable
// for exports/search), JSON only once a non-default style is applied.
export function serializeTextFmt(fmt: TextFmt): string {
  const { text, size, bold, italic, underline, strike, color, align } = fmt
  const isDefault =
    size === TEXT_DEFAULTS.size && !bold && !italic && !underline && !strike &&
    color === TEXT_DEFAULTS.color && align === TEXT_DEFAULTS.align
  return isDefault ? text : JSON.stringify(fmt)
}

// Extracts the plain, human-readable text of any card for display/export contexts
// (vote panel, Excel…), transparently unwrapping TEXT/LABEL formatting JSON.
export function cardDisplayText(card: { type: string; content: string }): string {
  if (card.type === 'TEXT') return parseTextFmt(card.content).text
  if (card.type === 'LABEL') return parseLabelFmt(card.content).text
  return card.content
}

// Renders a field value for display; DATE values are localized, everything else passes through.
export function formatFieldValue(type: string, value: string): string {
  if (type === 'DATE' && value) {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
  return value
}
