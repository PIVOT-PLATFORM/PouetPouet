// Tableaux du board — encodage du contenu + parsing presse-papier (Excel / Sheets / TSV).
// Le content d'une carte TABLE est un JSON { rows: string[][] } ; la première ligne
// est traitée comme en-tête côté rendu.

export interface TableData {
  rows: string[][]
  // Largeurs de colonnes en fractions (somme = 1, longueur = nb de colonnes).
  // Absent ⇒ colonnes de largeur égale.
  colW?: number[]
}

const DEFAULT_ROWS: string[][] = [
  ['', '', ''],
  ['', '', ''],
  ['', '', ''],
]

export function serializeTable(rows: string[][], colW?: number[]): string {
  const data: TableData = { rows }
  if (colW) data.colW = colW
  return JSON.stringify(data)
}

// Normalise un tableau de fractions à `cols` entrées sommant à 1 (égales par défaut).
export function normalizeColW(colW: number[] | undefined, cols: number): number[] {
  if (!colW || colW.length !== cols || colW.some((w) => !(w > 0))) {
    return Array(cols).fill(1 / cols)
  }
  const sum = colW.reduce((a, b) => a + b, 0)
  return colW.map((w) => w / sum)
}

export function parseTableContent(content: string): { rows: string[][]; colW: number[] } {
  try {
    const data = JSON.parse(content) as Partial<TableData>
    if (Array.isArray(data.rows) && data.rows.length > 0 && data.rows.every((r) => Array.isArray(r))) {
      const rows = normalizeRows(data.rows.map((r) => r.map((c) => String(c ?? ''))))
      return { rows, colW: normalizeColW(data.colW, rows[0].length) }
    }
  } catch {
    /* contenu invalide → grille par défaut */
  }
  const rows = DEFAULT_ROWS.map((r) => [...r])
  return { rows, colW: normalizeColW(undefined, rows[0].length) }
}

// Égalise le nombre de colonnes sur toutes les lignes (la plus large fait foi).
export function normalizeRows(rows: string[][]): string[][] {
  const cols = Math.max(1, ...rows.map((r) => r.length))
  return rows.map((r) => {
    const copy = [...r]
    while (copy.length < cols) copy.push('')
    return copy
  })
}

// Parse un tableau HTML (collage Excel / Google Sheets / pages web).
function parseHtmlTable(html: string): string[][] | null {
  if (!html || typeof DOMParser === 'undefined') return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return null
  const rows: string[][] = []
  for (const tr of Array.from(table.querySelectorAll('tr'))) {
    const cells = Array.from(tr.querySelectorAll('th,td')).map((c) =>
      (c.textContent ?? '').replace(/\s+/g, ' ').trim()
    )
    if (cells.length > 0) rows.push(cells)
  }
  return rows.length > 0 ? normalizeRows(rows) : null
}

// Parse du TSV (lignes \n, cellules \t). Ne renvoie un tableau que s'il y a
// au moins une tabulation — sinon c'est du texte simple, pas une grille.
function parseTsv(text: string): string[][] | null {
  if (!text || !text.includes('\t')) return null
  const lines = text.replace(/\r\n/g, '\n').replace(/\n+$/, '').split('\n')
  const rows = lines.map((l) => l.split('\t'))
  return rows.length > 0 ? normalizeRows(rows) : null
}

// Détecte un tableau dans le presse-papier : HTML prioritaire, puis TSV.
export function parseClipboardTable(html: string | undefined, text: string | undefined): string[][] | null {
  return parseHtmlTable(html ?? '') ?? parseTsv(text ?? '')
}
