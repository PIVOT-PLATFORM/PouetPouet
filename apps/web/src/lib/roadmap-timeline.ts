// Calculs de timeline pour l'éditeur Gantt de roadmap.
// Fonctions pures portées de l'outil autonome : colonnes par échelle, largeur de
// colonne (remplissage du viewport), conversion date ↔ pixel. Dates en chaînes
// ISO « yyyy-mm-dd » (granularité jour, pas de fuseau).

import type { RoadmapScale } from '@/hooks/useRoadmap'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export const SCALE_LABELS: Record<RoadmapScale, string> = {
  week: 'Semaine', month: 'Mois', quarter: 'Trimestre', semester: 'Semestre', year: 'Année',
}

const CW_MIN: Record<RoadmapScale, number> = { week: 64, month: 84, quarter: 124, semester: 168, year: 200 }

export interface Col {
  label: string
  sub: string
  start: Date
  end: Date
}

const DAY = 86400000
const z2 = (n: number) => String(n).padStart(2, '0')

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${z2(d.getMonth() + 1)}-${z2(d.getDate())}`
}
export function frDate(s: string): string {
  return parseDate(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
export function diffDays(a: string, b: string): number {
  return Math.max(0, Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / DAY))
}

function weekNum(d: Date): number {
  const j = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - j.getTime()) / DAY + j.getDay() + 1) / 7)
}

// Colonnes de la timeline entre start et end pour l'échelle donnée.
export function getCols(start: Date, end: Date, scale: RoadmapScale): Col[] {
  const cols: Col[] = []
  if (scale === 'year') {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      cols.push({ label: String(y), sub: '', start: new Date(y, 0, 1), end: new Date(y, 11, 31) })
    }
  } else if (scale === 'semester') {
    let y = start.getFullYear(), h = start.getMonth() < 6 ? 0 : 1
    for (;;) {
      const ms = h * 6, cs = new Date(y, ms, 1), ce = new Date(y, ms + 6, 0)
      if (cs > end) break
      cols.push({ label: `S${h + 1} ${y}`, sub: h === 0 ? 'Jan-Jun' : 'Jul-Déc', start: cs, end: ce })
      if (++h > 1) { h = 0; y++ }
    }
  } else if (scale === 'quarter') {
    let y = start.getFullYear(), q = Math.floor(start.getMonth() / 3)
    const QN = ['Jan-Mar', 'Avr-Jun', 'Jul-Sep', 'Oct-Déc']
    for (;;) {
      const ms = q * 3, cs = new Date(y, ms, 1), ce = new Date(y, ms + 3, 0)
      if (cs > end) break
      cols.push({ label: `T${q + 1} ${y}`, sub: QN[q], start: cs, end: ce })
      if (++q > 3) { q = 0; y++ }
    }
  } else if (scale === 'month') {
    const d = new Date(start.getFullYear(), start.getMonth(), 1)
    while (d <= end) {
      const cs = new Date(d), ce = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      cols.push({ label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, sub: '', start: cs, end: ce })
      d.setMonth(d.getMonth() + 1)
    }
  } else {
    const d = new Date(start), day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    while (d <= end) {
      const cs = new Date(d), ce = new Date(d)
      ce.setDate(ce.getDate() + 6)
      cols.push({ label: `S${weekNum(cs)}`, sub: `${cs.getDate()}/${cs.getMonth() + 1}`, start: cs, end: ce })
      d.setDate(d.getDate() + 7)
    }
  }
  return cols
}

// Largeur de colonne : au moins CW_MIN, mais étendue pour remplir le viewport.
export function colWidth(cols: Col[], scale: RoadmapScale, available: number): number {
  const n = cols.length
  if (!n) return CW_MIN[scale]
  return Math.max(CW_MIN[scale], Math.floor(available / n))
}

// Largeur totale de la timeline.
export function timelineWidth(cols: Col[], cw: number): number {
  return cols.length * cw
}

// Position X (px) d'une date dans la timeline.
export function dateToX(date: Date, start: Date, end: Date, totalWidth: number): number {
  if (end.getTime() === start.getTime()) return 0
  return Math.max(0, (date.getTime() - start.getTime()) / (end.getTime() - start.getTime()) * totalWidth)
}

// Date correspondant à une position X (px).
export function xToDate(px: number, start: Date, end: Date, totalWidth: number): Date {
  if (totalWidth === 0) return new Date(start)
  return new Date(start.getTime() + px / totalWidth * (end.getTime() - start.getTime()))
}
