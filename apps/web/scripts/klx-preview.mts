/**
 * Harnais de rendu hors-ligne pour l'import Klaxoon.
 *
 * Prend un .klx d'exemple, le passe par le converter réel, puis génère un PNG
 * qui reproduit les règles de rendu du board — pour comparer visuellement à
 * l'original Klaxoon sans navigateur.
 *
 * Deux modes :
 *   faithful (défaut) — applique les clamps MIN_W/MIN_H et la police fixe 14px,
 *                       exactement comme le board aujourd'hui (montre les bugs).
 *   ideal             — tailles brutes du converter + police proportionnelle à
 *                       la carte (cible visée).
 *
 * Usage (depuis apps/web) :
 *   npx tsx scripts/klx-preview.mts "Moving" faithful
 *   npx tsx scripts/klx-preview.mts "Moving" ideal
 *   npx tsx scripts/klx-preview.mts            # tous les samples, mode faithful
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { convertKlaxoon, type KlxImportResult, type KlxCard } from '../src/lib/klx-import/converter.js'
import { findKlxActivities, mediaKey, mimeForPath } from '../src/lib/klx-import/archive.js'

const require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const JSZip = require('jszip')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharp = require('sharp')

const SAMPLES = path.resolve(import.meta.dirname, '../src/lib/klx-import/samples')
const OUT = process.env.KLX_OUT ?? path.resolve(import.meta.dirname, '../../../.klx-preview')

// Board rendering constants (mirror apps/web/src/components/board).
const MIN_W = 150, MIN_H = 110, SHAPE_MIN = 80, MIN_LABEL_W = 60
const HEADER_H = 28          // TEXT card colored header band
const TEXT_FONT = 14         // TEXT_DEFAULTS.size — fixed regardless of card size
const MAX_OUT = 2600         // largest PNG dimension (keeps huge boards readable)

type Mode = 'faithful' | 'ideal'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function headerTint(hex: string): string {
  if (!/^#[0-9a-f]{3,6}$/i.test(hex)) return hex
  const [r, g, b] = hexToRgb(hex)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  const to = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  if (lum < 70) return `#${to(r + (255 - r) * 0.05)}${to(g + (255 - g) * 0.05)}${to(b + (255 - b) * 0.05)}`
  return `#${to(r * 0.95)}${to(g * 0.95)}${to(b * 0.95)}`
}

// Largeur/hauteur effectivement rendues par le board pour une carte.
function renderedSize(card: KlxCard, mode: Mode): { w: number; h: number } {
  if (mode === 'ideal') return { w: card.width, h: card.height }
  if (card.type === 'SHAPE' || card.type === 'DRAW') return { w: Math.max(card.width, SHAPE_MIN), h: Math.max(card.height, SHAPE_MIN) }
  if (card.type === 'LABEL') return { w: Math.max(card.width, MIN_LABEL_W), h: Math.max(card.height, 20) }
  return { w: Math.max(card.width, MIN_W), h: Math.max(card.height, MIN_H) }
}

// Découpe un texte en lignes tenant dans `innerW` px à la taille `font`.
function wrapText(text: string, innerW: number, font: number): string[] {
  const charW = font * 0.55
  const perLine = Math.max(1, Math.floor(innerW / charW))
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (para.length <= perLine) { out.push(para); continue }
    const words = para.split(' ')
    let line = ''
    for (const w of words) {
      if ((line + ' ' + w).trim().length <= perLine) line = (line + ' ' + w).trim()
      else { if (line) out.push(line); line = w.length > perLine ? w.slice(0, perLine) : w }
    }
    if (line) out.push(line)
  }
  return out
}

function textCardSvg(card: KlxCard, w: number, h: number, mode: Mode): string {
  const fmt = tryJson(card.content)
  const text = fmt?.text ?? card.content
  const header = headerTint(card.color)
  // Reflète le board : police = taille stockée × largeur/192 (REF_W), donc
  // proportionnelle à la carte. En 'ideal', pas d'en-tête (comparaison épurée).
  const baseSize = fmt?.size ?? TEXT_FONT
  const font = Math.round(Math.max(8, Math.min(240, baseSize * w / 192)))
  const headerH = mode === 'ideal' ? 0 : HEADER_H
  const innerW = w - 20
  const lines = wrapText(text, innerW, font)
  const lineH = font * 1.35
  const maxLines = Math.max(1, Math.floor((h - headerH - 12) / lineH))
  const shown = lines.slice(0, maxLines)
  const clipId = `clip-${card.klxId}`
  const tspans = shown.map((l, i) =>
    `<tspan x="${10}" dy="${i === 0 ? font + 4 : lineH}">${esc(l)}</tspan>`).join('')
  return `<g>
    <clipPath id="${clipId}"><rect x="0" y="0" width="${w}" height="${h}" rx="10"/></clipPath>
    <g clip-path="url(#${clipId})">
      <rect x="0" y="0" width="${w}" height="${h}" fill="${card.color}"/>
      ${headerH ? `<rect x="0" y="0" width="${w}" height="${headerH}" fill="${header}"/>` : ''}
      <text x="10" y="${headerH}" font-family="sans-serif" font-size="${font}" fill="#1f2937">${tspans}</text>
    </g>
    <rect x="0" y="0" width="${w}" height="${h}" rx="10" fill="none" stroke="#0002"/>
  </g>`
}

function labelCardSvg(card: KlxCard, w: number, h: number): string {
  const fmt = tryJson(card.content)
  const text = fmt?.text ?? card.content
  const font = fmt?.size ?? 16
  const color = fmt?.color ?? '#374151'
  const weight = fmt?.bold ? 700 : 400
  return `<text x="0" y="${font}" font-family="sans-serif" font-size="${font}" font-weight="${weight}" fill="${color}">${esc(String(text).split('\n')[0])}</text>`
}

function shapeCardSvg(card: KlxCard, w: number, h: number): string {
  const [, stroke, hasFill] = card.content.split('|')
  const sw = stroke === 'thin' ? 1.5 : stroke === 'thick' ? 6 : 3
  const fill = hasFill === 'true' ? card.color : 'none'
  return `<rect x="0" y="0" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${card.color}" stroke-width="${sw}"/>`
}

function drawCardSvg(card: KlxCard): string {
  return `<path d="${esc(card.content)}" fill="none" stroke="${card.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
}

function imageCardSvg(card: KlxCard, w: number, h: number): string {
  return `<image x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" xlink:href="${card.content}"/>`
}

function tryJson(raw: string): { text: string; size?: number; color?: string; bold?: boolean } | null {
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object' && 'text' in p) return p
  } catch { /* plain text */ }
  return null
}

function boardToSvg(result: KlxImportResult, mode: Mode): { svg: string; outW: number; outH: number } {
  const boxes = result.cards.map((c) => {
    const { w, h } = renderedSize(c, mode)
    return { x: c.posX, y: c.posY, w, h }
  })
  for (const f of result.frames) boxes.push({ x: f.posX, y: f.posY, w: f.width, h: f.height })
  const minX = Math.min(0, ...boxes.map((b) => b.x))
  const minY = Math.min(0, ...boxes.map((b) => b.y))
  const maxX = Math.max(...boxes.map((b) => b.x + b.w), minX + 100)
  const maxY = Math.max(...boxes.map((b) => b.y + b.h), minY + 100)
  const pad = 40
  const vbX = minX - pad, vbY = minY - pad
  const vbW = maxX - minX + pad * 2, vbH = maxY - minY + pad * 2

  const scale = Math.min(1, MAX_OUT / Math.max(vbW, vbH))
  const outW = Math.round(vbW * scale), outH = Math.round(vbH * scale)

  // Centre des cartes → connexions.
  const centerOf = new Map<string, { x: number; y: number }>()
  for (const c of result.cards) {
    const { w, h } = renderedSize(c, mode)
    centerOf.set(c.klxId, { x: c.posX + w / 2, y: c.posY + h / 2 })
  }

  const frameEls = result.frames.map((f) =>
    `<g>
       <rect x="${f.posX}" y="${f.posY}" width="${f.width}" height="${f.height}" rx="12" fill="#6366f108" stroke="#6366f155" stroke-width="2"/>
       <text x="${f.posX + 12}" y="${f.posY + 28}" font-family="sans-serif" font-size="20" font-weight="700" fill="#6366f1">${esc(f.title)}</text>
     </g>`).join('\n')

  const connEls = result.connections.map((cn) => {
    const a = centerOf.get(cn.fromKlxId), b = centerOf.get(cn.toKlxId)
    if (!a || !b) return ''
    const dash = cn.dashed ? ' stroke-dasharray="8,6"' : ''
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${cn.color}" stroke-width="${Math.max(1.5, cn.width)}"${dash} marker-end="url(#arrow)"/>`
  }).join('\n')

  const cardEls = [...result.cards].sort((a, b) => a.zIndex - b.zIndex).map((c) => {
    const { w, h } = renderedSize(c, mode)
    let inner = ''
    if (c.type === 'TEXT') inner = textCardSvg(c, w, h, mode)
    else if (c.type === 'IMAGE') inner = imageCardSvg(c, w, h)
    else if (c.type === 'LABEL') inner = labelCardSvg(c, w, h)
    else if (c.type === 'SHAPE') inner = shapeCardSvg(c, w, h)
    else if (c.type === 'DRAW') inner = drawCardSvg(c)
    return `<g transform="translate(${c.posX},${c.posY})">${inner}</g>`
  }).join('\n')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${outW}" height="${outH}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">
    <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 Z" fill="#666"/></marker></defs>
    <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="#fafafa"/>
    ${frameEls}
    ${connEls}
    ${cardEls}
  </svg>`
  return { svg, outW, outH }
}

async function loadKlx(file: string): Promise<KlxImportResult> {
  const zip = await JSZip.loadAsync(fs.readFileSync(file))
  const entryPaths = Object.keys(zip.files).filter((p: string) => !zip.files[p].dir)
  const [activity] = findKlxActivities(entryPaths)
  const data = JSON.parse(await zip.files[activity.brainstormPath].async('text'))
  const imageMap = new Map<string, string>()
  for (const p of entryPaths.filter((p: string) => p.startsWith(activity.mediaPrefix))) {
    const b64 = await zip.files[p].async('base64')
    imageMap.set(mediaKey(p), `data:${mimeForPath(p)};base64,${b64}`)
  }
  return convertKlaxoon(data, imageMap)
}

async function main() {
  const [filter, modeArg] = process.argv.slice(2)
  const mode: Mode = modeArg === 'ideal' ? 'ideal' : 'faithful'
  fs.mkdirSync(OUT, { recursive: true })

  const files = fs.readdirSync(SAMPLES).filter((f) => f.endsWith('.klx') && (!filter || f.toLowerCase().includes(filter.toLowerCase())))
  if (files.length === 0) { console.log('Aucun .klx ne correspond à', filter); return }

  for (const name of files) {
    const result = await loadKlx(path.join(SAMPLES, name))
    const { svg, outW, outH } = boardToSvg(result, mode)
    const base = name.replace(/\.klx$/, '').replace(/[^\w]+/g, '_')
    const outPath = path.join(OUT, `${base}.${mode}.png`)
    await sharp(Buffer.from(svg)).png().toFile(outPath)
    console.log(`✅ ${outPath}  (${outW}×${outH}, ${result.stats.postits}p ${result.stats.images}i ${result.stats.draws}d ${result.stats.shapes}s ${result.frames.length}f)`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
