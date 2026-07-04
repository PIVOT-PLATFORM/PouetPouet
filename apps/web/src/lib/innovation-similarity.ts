import Fuse from 'fuse.js'

export interface SimilarityCandidate {
  id: string
  title: string
  pitch: string
}

// Rapprochement flou côté client (aucune route serveur, aucune IA) sur titre/pitch —
// suggestion non bloquante à la saisie pour limiter les fiches redondantes.
// threshold bas = correspondance plus stricte (0 = exact, 1 = tout matche).
export function findSimilarFiches<T extends SimilarityCandidate>(
  fiches: T[],
  query: string,
  options: { limit?: number; threshold?: number } = {},
): T[] {
  const { limit = 3, threshold = 0.4 } = options
  const trimmed = query.trim()
  if (trimmed.length < 3 || fiches.length === 0) return []

  const fuse = new Fuse(fiches, { keys: ['title', 'pitch'], threshold, ignoreLocation: true })
  return fuse.search(trimmed).slice(0, limit).map((r) => r.item)
}
