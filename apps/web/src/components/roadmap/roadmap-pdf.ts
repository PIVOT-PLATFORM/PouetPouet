import type { RoadmapDetail, RoadmapItem } from '@/hooks/useRoadmap'
import { getCols, parseDate, frDate } from '@/lib/roadmap-timeline'
import { CATEGORIES, RISKS, textOn } from './roadmap-constants'

// Export PDF vectoriel du Gantt (A4 paysage), dessiné depuis les données — pas une
// capture DOM : sortie nette, indépendante du zoom/scroll. Pagination verticale
// quand il y a trop d'items ; toute la timeline tient en largeur de page.

const hexRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]

// Tronque un texte à la largeur dispo (en points), avec ellipse.
function fit(doc: { getTextWidth: (s: string) => number }, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text
  let s = text
  while (s.length > 1 && doc.getTextWidth(s + '…') > maxW) s = s.slice(0, -1)
  return s + '…'
}

export async function exportRoadmapPDF(roadmap: RoadmapDetail, items: RoadmapItem[]): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const M = 32
  const contentW = pageW - 2 * M
  const TITLE_H = 40
  const HEADER_H = 24
  const LEGEND_H = 30
  const ROW_H = 22
  const BAR_H = 14

  const start = parseDate(roadmap.startDate)
  const end = parseDate(roadmap.endDate)
  const span = end.getTime() - start.getTime() || 1
  const cols = getCols(start, end, roadmap.scale)
  const colW = contentW / (cols.length || 1)
  const today = new Date()

  const headTop = M + TITLE_H
  const rowsTop = headTop + HEADER_H
  const rowsBottom = pageH - M - LEGEND_H
  const rowsPerPage = Math.max(1, Math.floor((rowsBottom - rowsTop) / ROW_H))
  const totalPages = Math.max(1, Math.ceil(items.length / rowsPerPage))

  const xOf = (iso: string) => M + ((parseDate(iso).getTime() - start.getTime()) / span) * contentW

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage()

    // ── Titre ──
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(26, 29, 46)
    doc.text(fit(doc, roadmap.name, contentW - 120), M, M + 16)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120, 120, 140)
    doc.text(`${frDate(roadmap.startDate)}  →  ${frDate(roadmap.endDate)}   ·   ${items.length} item${items.length !== 1 ? 's' : ''}`, M, M + 30)
    if (totalPages > 1) doc.text(`Page ${page + 1}/${totalPages}`, pageW - M, M + 16, { align: 'right' })

    // ── En-tête colonnes + grille ──
    doc.setLineWidth(0.5)
    doc.setFontSize(8)
    cols.forEach((col, i) => {
      const x = M + i * colW
      doc.setFillColor(240, 241, 248); doc.rect(x, headTop, colW, HEADER_H, 'F')
      doc.setDrawColor(228, 230, 242); doc.line(x, headTop, x, rowsBottom)
      doc.setTextColor(90, 95, 126); doc.setFont('helvetica', 'bold')
      doc.text(fit(doc, col.label, colW - 6), x + 4, headTop + 11)
      if (col.sub) {
        doc.setFont('helvetica', 'normal'); doc.setTextColor(146, 150, 176)
        doc.text(fit(doc, col.sub, colW - 6), x + 4, headTop + 20)
      }
    })
    doc.setDrawColor(228, 230, 242)
    doc.line(M + cols.length * colW, headTop, M + cols.length * colW, rowsBottom)
    doc.setDrawColor(200, 203, 227)
    doc.line(M, headTop + HEADER_H, M + contentW, headTop + HEADER_H)

    // ── Marqueur aujourd'hui ──
    if (today >= start && today <= end) {
      const tx = M + ((today.getTime() - start.getTime()) / span) * contentW
      doc.setDrawColor(239, 68, 68); doc.setLineWidth(1)
      doc.line(tx, headTop, tx, rowsBottom); doc.setLineWidth(0.5)
    }

    // ── Barres ──
    const slice = items.slice(page * rowsPerPage, (page + 1) * rowsPerPage)
    slice.forEach((item, r) => {
      const y = rowsTop + r * ROW_H
      const xa = xOf(item.startDate)
      const xb = xOf(item.endDate)
      // hors plage → on saute la barre
      if (xb <= M || xa >= M + contentW) return
      const x1 = Math.max(M, xa)
      const bw = Math.max(6, Math.min(M + contentW, xb) - x1)
      const cats = item.categories.length ? item.categories : (['dev'] as const)
      const catColor = CATEGORIES[cats[0]]?.color ?? '#2a9d5c'
      const [cr, cg, cb] = hexRgb(catColor)
      doc.setFillColor(cr, cg, cb)
      doc.roundedRect(x1, y + (ROW_H - BAR_H) / 2, bw, BAR_H, 3, 3, 'F')

      // point de risque
      const [rr, rg, rb] = hexRgb(RISKS[item.risk].color)
      doc.setFillColor(rr, rg, rb); doc.circle(x1 + 6, y + ROW_H / 2, 2.2, 'F')

      // libellé dans la barre
      if (bw > 26) {
        const fg = textOn(catColor) === '#fff' ? [255, 255, 255] : [26, 29, 46]
        doc.setTextColor(fg[0], fg[1], fg[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
        const label = (item.prio === 'must' ? '* ' : '') + item.name
        doc.text(fit(doc, label, bw - 16), x1 + 12, y + ROW_H / 2 + 3)
      }
    })

    // ── Légende ──
    let lx = M
    const ly = pageH - M - LEGEND_H + 16
    doc.setFontSize(8); doc.setFont('helvetica', 'normal')
    const chip = (color: string, label: string, round = false) => {
      const [a, b, c] = hexRgb(color)
      doc.setFillColor(a, b, c)
      if (round) doc.circle(lx + 4, ly - 2, 3, 'F')
      else doc.roundedRect(lx, ly - 6, 8, 8, 1.5, 1.5, 'F')
      doc.setTextColor(90, 95, 126)
      doc.text(label, lx + 12, ly)
      lx += 14 + doc.getTextWidth(label) + 14
    }
    doc.setTextColor(120, 120, 140); doc.text('Domaine :', lx, ly); lx += doc.getTextWidth('Domaine :') + 8
    chip(CATEGORIES.infra.color, 'Infra'); chip(CATEGORIES.dev.color, 'Dev'); chip(CATEGORIES.cyber.color, 'Cyber')
    doc.setTextColor(120, 120, 140); doc.text('Risque :', lx, ly); lx += doc.getTextWidth('Risque :') + 8
    chip(RISKS.low.color, 'Faible', true); chip(RISKS.med.color, 'Moyen', true); chip(RISKS.high.color, 'Élevé', true)
    doc.setTextColor(120, 120, 140); doc.text('*  Must', lx, ly)
  }

  if (items.length === 0) {
    doc.setFontSize(11); doc.setTextColor(150, 150, 165)
    doc.text('Aucun item sur la roadmap', M, rowsTop + 20)
  }

  doc.save(`${roadmap.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'roadmap'}.pdf`)
}
