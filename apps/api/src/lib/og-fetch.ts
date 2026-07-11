import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export interface OgMeta {
  title?: string
  description?: string
  image?: string
  siteName?: string
}

function extractMeta(html: string, prop: string): string | undefined {
  const r1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']{1,500})["']`, 'i')
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+(?:property|name)=["']${prop}["']`, 'i')
  return (html.match(r1) ?? html.match(r2))?.[1]?.trim() || undefined
}

function resolveUrl(base: string, maybeRelative: string | undefined): string | undefined {
  if (!maybeRelative) return undefined
  try {
    return new URL(maybeRelative, base).href
  } catch {
    return undefined
  }
}

// Anti-SSRF : refuse tout hôte qui résout vers une plage privée/loopback/link-local
// (dont 169.254.169.254, le metadata server cloud) — un utilisateur peut faire
// fetcher n'importe quelle URL au serveur via une carte LINK/TEXT.
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true
  const [a, b] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast + réservé
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase()
  if (norm === '::1' || norm === '::') return true
  const first = parseInt(norm.split(':')[0] || '0', 16) || 0
  if (first >= 0xfc00 && first <= 0xfdff) return true // unique local fc00::/7
  if (first >= 0xfe80 && first <= 0xfebf) return true // link-local fe80::/10
  const v4 = norm.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (v4 && (norm.startsWith('::ffff:') || norm.startsWith('64:ff9b::'))) return isPrivateIPv4(v4[1])
  return false
}

export function isPrivateIP(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPrivateIPv4(ip)
  if (version === 6) return isPrivateIPv6(ip)
  return true // pas une IP valide → on bloque par prudence
}

async function isSafeHost(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return !isPrivateIP(hostname)
  try {
    const results = await lookup(hostname, { all: true })
    return results.length > 0 && results.every((r) => !isPrivateIP(r.address))
  } catch {
    return false
  }
}

const MAX_BODY_BYTES = 100_000 // les balises OG sont toujours dans le <head>
const MAX_REDIRECTS = 5

export async function fetchOgMeta(rawUrl: string): Promise<OgMeta | null> {
  try {
    let currentUrl = new URL(rawUrl) // throws if not a valid URL
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    try {
      let res: Response
      // Suit les redirections manuellement pour revalider chaque hop (protocole +
      // résolution DNS) — 'redirect: follow' laisserait fetch() atterrir sur une IP
      // privée sans repasser par isSafeHost().
      for (let hop = 0; ; hop++) {
        if (hop > MAX_REDIRECTS) return null
        if (currentUrl.protocol !== 'http:' && currentUrl.protocol !== 'https:') return null
        if (!(await isSafeHost(currentUrl.hostname))) return null

        res = await fetch(currentUrl.href, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PouetPouetBot/1.0; +https://github.com/0bno/PouetPouet)' },
          redirect: 'manual',
        })

        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('location')
          if (!location) return null
          currentUrl = new URL(location, currentUrl.href)
          continue
        }
        break
      }

      if (!res.ok) return null
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('html')) return null

      const html = await readBodyCapped(res, MAX_BODY_BYTES)

      const title = extractMeta(html, 'og:title') ?? extractMeta(html, 'twitter:title') ?? html.match(/<title>([^<]{1,200})<\/title>/i)?.[1]?.trim()
      const description = extractMeta(html, 'og:description') ?? extractMeta(html, 'twitter:description') ?? extractMeta(html, 'description')
      const rawImage = extractMeta(html, 'og:image') ?? extractMeta(html, 'twitter:image')
      const image = resolveUrl(currentUrl.href, rawImage)
      const siteName = extractMeta(html, 'og:site_name')

      if (!title && !image) return null
      return { title, description: description?.slice(0, 300), image, siteName }
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return null
  }
}

// Lit le corps en streaming et s'arrête dès que le plafond est atteint, plutôt
// que de charger une réponse potentiellement énorme en mémoire avant de la tronquer.
async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      total += value.byteLength
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)), Math.min(total, maxBytes)).toString('utf-8')
}
