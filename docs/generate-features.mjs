// Génère le PDF "Guide des fonctionnalités" depuis FEATURES.md.
// Source unique = FEATURES.md (markdown) ; la version est tamponnée depuis le
// package.json racine pour rester synchro avec les releases.
//
// Run: node docs/generate-features.mjs
// Sortie: apps/web/public/aide/FEATURES.pdf (servi par la page Aide) + docs/FEATURES.pdf

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
const SRC = readFileSync(join(ROOT, 'FEATURES.md'), 'utf8')

const PW = 595.28, PH = 841.89, M = 50
const CW = PW - 2 * M
const cl = {
  accent: rgb(0.31, 0.27, 0.90),
  accentSoft: rgb(0.45, 0.42, 0.85),
  text: rgb(0.12, 0.12, 0.16),
  gray: rgb(0.40, 0.40, 0.48),
  rule: rgb(0.82, 0.82, 0.88),
  codeBg: rgb(0.95, 0.95, 0.98),
}

const doc = await PDFDocument.create()
const F = await doc.embedFont(StandardFonts.Helvetica)
const FB = await doc.embedFont(StandardFonts.HelveticaBold)
const FC = await doc.embedFont(StandardFonts.Courier)

let page, y
function newPage() {
  page = doc.addPage([PW, PH])
  y = PH - M
}
function space(h) {
  if (y - h < M) newPage()
  else y -= h
}
function fontFor(style) {
  if (style === 'bold') return FB
  if (style === 'code') return FC
  return F
}

// WinAnsi (StandardFonts) ne couvre pas tout l'Unicode : on remplace les
// caractères typographiques/flèches/emoji par des équivalents encodables.
function san(t) {
  return t
    .replace(/→/g, '->').replace(/←/g, '<-').replace(/↔/g, '<->')
    .replace(/⇒/g, '=>').replace(/…/g, '...')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-').replace(/ /g, ' ')
    .replace(/[^\x00-\xFF]/g, '') // retire emoji / exotiques restants
}

// Inline: découpe **gras** et `code` en runs {text, style}.
function parseInline(rawText) {
  const text = san(rawText)
  const runs = []
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), style: 'normal' })
    if (m[2] != null) runs.push({ text: m[2], style: 'bold' })
    else runs.push({ text: m[3], style: 'code' })
    last = re.lastIndex
  }
  if (last < text.length) runs.push({ text: text.slice(last), style: 'normal' })
  return runs.length ? runs : [{ text, style: 'normal' }]
}

// Flow de runs avec wrapping et changement de police en cours de ligne.
function drawRuns(runs, x, maxW, size, color, lineH) {
  const words = []
  for (const r of runs) {
    const parts = r.text.split(/(\s+)/)
    for (const p of parts) if (p.length) words.push({ text: p, style: r.style, space: /^\s+$/.test(p) })
  }
  let lineX = x
  if (y - lineH < M) newPage(), (y = y)
  for (const w of words) {
    const fnt = fontFor(w.style)
    const wWidth = fnt.widthOfTextAtSize(w.text, size)
    if (!w.space && lineX + wWidth > x + maxW) {
      y -= lineH
      if (y < M) { newPage() }
      lineX = x
    }
    if (w.space && lineX === x) continue // pas d'espace en début de ligne
    page.drawText(w.text, { x: lineX, y, size, font: fnt, color: w.style === 'code' ? cl.accentSoft : color })
    lineX += wWidth
  }
  y -= lineH
}

function rule() {
  space(10)
  page.drawLine({ start: { x: M, y }, end: { x: PW - M, y }, thickness: 0.6, color: cl.rule })
  space(8)
}

// Découpe une liste de runs en lignes qui tiennent dans maxW (sans dessiner).
function wrapRuns(runs, maxW, size) {
  const words = []
  for (const r of runs) {
    const parts = r.text.split(/(\s+)/)
    for (const p of parts) if (p.length) words.push({ text: p, style: r.style, space: /^\s+$/.test(p) })
  }
  const lines = [[]]
  let lineW = 0
  for (const w of words) {
    const cur = lines[lines.length - 1]
    if (w.space && cur.length === 0) continue // pas d'espace en début de ligne
    const ww = fontFor(w.style).widthOfTextAtSize(w.text, size)
    if (!w.space && lineW + ww > maxW && cur.length) {
      lines.push([w])
      lineW = ww
    } else {
      cur.push(w)
      lineW += ww
    }
  }
  return lines.map((l) => {
    while (l.length && l[l.length - 1].space) l.pop()
    return l
  })
}

// Dessine des lignes pré-wrappées à partir de topY, sans toucher au y global.
function drawWrappedLines(wrapped, x, topY, size, lineH, color) {
  let yy = topY
  for (const line of wrapped) {
    let lx = x
    for (const w of line) {
      const fnt = fontFor(w.style)
      page.drawText(w.text, { x: lx, y: yy, size, font: fnt, color: w.style === 'code' ? cl.accentSoft : color })
      lx += fnt.widthOfTextAtSize(w.text, size)
    }
    yy -= lineH
  }
}

// Rend un tableau markdown (tableau de lignes, chaque ligne = tableau de cellules)
// en colonnes alignées : en-tête en gras + filet, wrapping interne par cellule.
function renderTable(rows) {
  if (!rows.length) return
  const ncols = Math.max(...rows.map((r) => r.length))
  const size = 9
  const lineH = 12
  const gutter = 12
  const padY = 6

  // Largeur "naturelle" (sur une ligne) de chaque colonne pour répartir l'espace.
  const natural = new Array(ncols).fill(0)
  rows.forEach((r, ri) => {
    for (let c = 0; c < ncols; c++) {
      const runs = parseInline(r[c] || '')
      let w = 0
      for (const run of runs) w += fontFor(ri === 0 ? 'bold' : run.style).widthOfTextAtSize(run.text, size)
      natural[c] = Math.max(natural[c], w)
    }
  })
  const avail = CW - gutter * (ncols - 1)
  const sum = natural.reduce((a, b) => a + b, 0) || 1
  let widths = natural.map((n) => Math.max(48, (n / sum) * avail))
  const wsum = widths.reduce((a, b) => a + b, 0)
  if (wsum > avail) widths = widths.map((w) => (w * avail) / wsum)
  const xs = []
  let cx = M
  for (let c = 0; c < ncols; c++) { xs.push(cx); cx += widths[c] + gutter }

  rows.forEach((r, ri) => {
    const isHeader = ri === 0
    const cellLines = []
    let maxLines = 1
    for (let c = 0; c < ncols; c++) {
      let runs = parseInline(r[c] || '')
      if (isHeader) runs = runs.map((x) => ({ ...x, style: 'bold' }))
      const wl = wrapRuns(runs, widths[c], size)
      cellLines.push(wl)
      maxLines = Math.max(maxLines, wl.length)
    }
    const rowH = maxLines * lineH + padY
    if (y - rowH < M) newPage()
    const topY = y
    for (let c = 0; c < ncols; c++) drawWrappedLines(cellLines[c], xs[c], topY, size, lineH, cl.text)
    y = topY - rowH
    if (isHeader) page.drawLine({ start: { x: M, y: y + padY * 0.6 }, end: { x: PW - M, y: y + padY * 0.6 }, thickness: 0.5, color: cl.rule })
  })
  space(4)
}

// ---- Cover ----
newPage()
y = PH - 150
page.drawText('Guide des fonctionnalités', { x: M, y, size: 28, font: FB, color: cl.text })
y -= 34
page.drawText('PIVOT / PouetPouet', { x: M, y, size: 16, font: F, color: cl.gray })
y -= 40
page.drawRectangle({ x: M, y: y - 4, width: 90, height: 24, color: cl.accent })
page.drawText(`v${VERSION}`, { x: M + 12, y: y + 2, size: 13, font: FB, color: rgb(1, 1, 1) })
y -= 30
const today = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })
page.drawText(`Généré le ${today} · source : FEATURES.md`, { x: M, y, size: 10, font: F, color: cl.gray })

// ---- Body ----
newPage()
const lines = SRC.split('\n')
for (let i = 0; i < lines.length; i++) {
  const raw = lines[i]
  const line = raw.replace(/\s+$/, '')

  if (line === '---') { rule(); continue }
  if (line.trim() === '') { space(6); continue }

  // Tableaux markdown : on rassemble tout le bloc (lignes |...|, en sautant la
  // ligne séparatrice |---|---|) puis on le rend en colonnes alignées.
  if (/^\s*\|.*\|\s*$/.test(line)) {
    const rows = []
    let j = i
    while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j].replace(/\s+$/, ''))) {
      const l = lines[j].replace(/\s+$/, '')
      if (!/^\s*\|[\s:|-]+\|\s*$/.test(l)) {
        rows.push(l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
      }
      j++
    }
    i = j - 1
    renderTable(rows)
    continue
  }

  if (line.startsWith('### ')) {
    space(16)
    drawRuns(parseInline(line.slice(4)), M, CW, 12.5, cl.text, 16)
    continue
  }
  if (line.startsWith('## ')) {
    space(22)
    drawRuns(parseInline(line.slice(3)), M, CW, 16, cl.accent, 20)
    space(2)
    continue
  }
  if (line.startsWith('# ')) {
    space(20)
    drawRuns(parseInline(line.slice(2)), M, CW, 21, cl.text, 26)
    continue
  }

  // Bullets (avec niveau d'indentation 2 espaces)
  const bm = line.match(/^(\s*)-\s+(.*)$/)
  if (bm) {
    const level = Math.floor(bm[1].length / 2)
    const x = M + 10 + level * 14
    if (y - 14 < M) newPage()
    page.drawText('•', { x: x - 10, y: y - 0.5, size: 11, font: FB, color: cl.accentSoft })
    drawRuns(parseInline(bm[2]), x, CW - (x - M), 10.5, cl.text, 14)
    continue
  }

  // Paragraphe
  drawRuns(parseInline(line), M, CW, 10.5, cl.text, 14)
}

const bytes = await doc.save()
for (const out of ['apps/web/public/aide/FEATURES.pdf', 'docs/FEATURES.pdf']) {
  writeFileSync(join(ROOT, out), bytes)
  console.log('écrit:', out, `(v${VERSION}, ${doc.getPageCount()} pages)`)
}
