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
