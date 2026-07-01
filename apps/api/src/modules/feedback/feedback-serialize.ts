// Sérialisation pure d'un ticket feedback vers le DTO API. Extraite des routes
// pour être testable unitairement. `hasVoted` est par-utilisateur : il n'est
// vrai que si l'appelant (userId) a un vote inclus dans la relation `votes`.

export type FeedbackTicketRow = {
  id: string
  title: string
  body: string
  type: string
  column: string
  authorName: string
  authorId: string | null
  createdAt: Date
  updatedAt: Date
  _count?: { votes: number }
  votes?: { id: string }[]
}

export function serializeTicket(t: FeedbackTicketRow, userId: string | null) {
  return {
    id: t.id,
    title: t.title,
    body: t.body,
    type: t.type,
    column: t.column,
    authorName: t.authorName,
    authorId: t.authorId,
    votes: t._count?.votes ?? 0,
    hasVoted: userId && t.votes ? t.votes.length > 0 : false,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}
