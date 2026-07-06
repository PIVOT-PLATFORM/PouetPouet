// Locates the Klaxoon files inside a decompressed .klx archive (a .klx is a
// plain zip). Pure — takes a flat list of entry paths, no I/O — so it can be
// unit-tested without a real archive.

export interface KlxActivityEntry {
  brainstormPath: string // full path to this activity's _brainstorm_data.json
  mediaPrefix: string    // path prefix for this activity's mediabundle/ folder
  label: string          // best-effort display name (parent folder name)
}

const BRAINSTORM_FILE = '_brainstorm_data.json'

// A .klx can bundle several Klaxoon "Activity" boards (one per top-level
// export); each carries its own _brainstorm_data.json and mediabundle/ folder
// side by side, so every match is independent of the others.
export function findKlxActivities(entryPaths: string[]): KlxActivityEntry[] {
  const activities: KlxActivityEntry[] = []
  for (const path of entryPaths) {
    if (!path.endsWith(BRAINSTORM_FILE)) continue
    const dir = path.slice(0, path.length - BRAINSTORM_FILE.length) // includes trailing '/', may be ''
    const parts = dir.split('/').filter(Boolean)
    const label = parts[parts.length - 1] || 'Board'
    activities.push({ brainstormPath: path, mediaPrefix: `${dir}mediabundle/`, label })
  }
  return activities
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  gif: 'image/gif',
}

export function mimeForPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

// _brainstorm_data.json references images by a path relative to the activity
// folder (e.g. "mediabundle/9bf/9bf5ab21….svg") — strip everything before it
// so the key matches regardless of where the activity sits inside the zip.
export function mediaKey(path: string): string {
  const idx = path.indexOf('mediabundle/')
  return idx >= 0 ? path.slice(idx) : path
}
