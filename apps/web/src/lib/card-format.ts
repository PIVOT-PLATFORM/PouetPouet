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

// Renders a field value for display; DATE values are localized, everything else passes through.
export function formatFieldValue(type: string, value: string): string {
  if (type === 'DATE' && value) {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }
  return value
}
