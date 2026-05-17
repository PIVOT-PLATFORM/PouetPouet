export type SessionStatus = 'WAITING' | 'ACTIVE' | 'CLOSED'

export interface Session {
  id: string
  boardId: string
  code: string
  status: SessionStatus
  createdAt: Date
  closedAt: Date | null
}

export interface SessionParticipant {
  id: string
  sessionId: string
  userId: string | null
  guestName: string | null
  joinedAt: Date
}
