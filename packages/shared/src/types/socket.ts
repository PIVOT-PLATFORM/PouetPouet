import type { Card } from './board.js'
import type { Activity, ActivityResponse } from './activity.js'
import type { Session, SessionParticipant } from './session.js'

export interface ServerToClientEvents {
  'board:cards': (cards: Card[]) => void
  'card:created': (card: Card) => void
  'card:moved': (card: Card) => void
  'card:updated': (card: Card) => void
  'card:deleted': (id: string) => void
  'session:joined': (data: { session: Session; participant: SessionParticipant }) => void
  'session:participant_count': (count: number) => void
  'activity:launched': (activity: Activity) => void
  'activity:responses_updated': (data: { activityId: string; responses: ActivityResponse[] }) => void
  error: (message: string) => void
}

export interface ClientToServerEvents {
  'board:join': (boardId: string) => void
  'board:leave': (boardId: string) => void
  'card:create': (data: { boardId: string; content: string; posX: number; posY: number; color?: string }) => void
  'card:move': (data: { id: string; boardId: string; posX: number; posY: number }) => void
  'card:update': (data: { id: string; boardId: string; content: string }) => void
  'card:delete': (data: { id: string; boardId: string }) => void
  'session:join': (data: { code: string; guestName?: string }) => void
  'activity:launch': (data: { sessionId: string; type: string; title: string; config: object }) => void
  'activity:respond': (data: { activityId: string; value: unknown }) => void
}
