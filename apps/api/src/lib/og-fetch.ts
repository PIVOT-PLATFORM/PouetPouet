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

export async function fetchOgMeta(rawUrl: string): Promise<OgMeta | null> {
  try {
    const url = new URL(rawUrl) // throws if not a valid URL
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    let res: Response
    try {
      res = await fetch(url.href, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PouetPouetBot/1.0; +https://github.com/0bno/PouetPouet)' },
        redirect: 'follow',
      })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('html')) return null
    // Read at most 100 KB — OG tags are always in <head>
    const buf = await res.arrayBuffer()
    const html = new TextDecoder().decode(buf.slice(0, 100_000))

    const title = extractMeta(html, 'og:title') ?? extractMeta(html, 'twitter:title') ?? html.match(/<title>([^<]{1,200})<\/title>/i)?.[1]?.trim()
    const description = extractMeta(html, 'og:description') ?? extractMeta(html, 'twitter:description') ?? extractMeta(html, 'description')
    const rawImage = extractMeta(html, 'og:image') ?? extractMeta(html, 'twitter:image')
    const image = resolveUrl(url.href, rawImage)
    const siteName = extractMeta(html, 'og:site_name')

    if (!title && !image) return null
    return { title, description: description?.slice(0, 300), image, siteName }
  } catch {
    return null
  }
}
