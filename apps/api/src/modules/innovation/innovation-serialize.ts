// Sérialisation pure d'une fiche innovation vers le DTO API. Extraite des
// routes pour être testable unitairement. Toutes les routes du module sont
// authentifiées (visibilité globale, pas de mode public) : `votes`/`hasVoted`
// sont donc toujours calculés pour l'appelant, sans branche nullable.

export type InnovationFicheRow = {
  id: string
  title: string
  pitch: string
  probleme: string | null
  solution: string | null
  benefices: string | null
  status: string
  abandonReason: string | null
  authorId: string
  createdAt: Date
  updatedAt: Date
  author: { id: string; name: string }
  contributors: { user: { id: string; name: string } }[]
  _count: { votes: number }
  votes: { id: string }[]
}

export function serializeFiche(f: InnovationFicheRow) {
  return {
    id: f.id,
    title: f.title,
    pitch: f.pitch,
    probleme: f.probleme,
    solution: f.solution,
    benefices: f.benefices,
    status: f.status,
    abandonReason: f.abandonReason,
    authorId: f.authorId,
    author: f.author,
    contributors: f.contributors.map((c) => c.user),
    votes: f._count.votes,
    hasVoted: f.votes.length > 0,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }
}
