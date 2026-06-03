// Data model for boards — shared by the useBoard hook and board components.

export interface FieldValue {
  id: string
  cardId: string
  fieldId: string
  value: string
}

export interface Card {
  id: string
  boardId: string
  type: string
  content: string
  posX: number
  posY: number
  width: number
  height: number
  color: string
  groupId: string | null
  groupColor: string | null
  locked: boolean
  fieldValues: FieldValue[]
}

export type ConnShape = 'straight' | 'curved' | 'orthogonal'
export type ConnArrow = 'none' | 'end' | 'start' | 'both'

export interface Connection {
  id: string
  boardId: string
  fromId: string
  toId: string
  label: string | null
  color: string | null
  shape: ConnShape
  arrow: ConnArrow
  dashed: boolean
  width: number
}

export type ConnectionPatch = Partial<Pick<Connection, 'label' | 'color' | 'shape' | 'arrow' | 'dashed' | 'width'>>

export interface Frame {
  id: string
  boardId: string
  title: string
  posX: number
  posY: number
  width: number
  height: number
  color: string
  // When active, dragging the frame carries every unlocked card inside it.
  // When inactive (default), the frame moves alone and captures nothing.
  active: boolean
}

export interface BoardField {
  id: string
  boardId: string
  name: string
  emoji: string | null
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT'
  options: string[] | null
  order: number
}

export interface BoardDetail {
  id: string
  name: string
  description: string | null
  coverImage: string | null
  maxParticipants: number | null
  enabledActivities: string[] | null
  templateDraftOf: string | null
  cards: Card[]
}

export interface PresenceUser {
  id: string
  name: string
  avatar: string | null
}

export interface BoardMember {
  id: string
  name: string
  avatar: string | null
  role: 'OWNER' | 'EDITOR' | 'VIEWER'
}

export interface BoardVote {
  id: string
  sessionId: string
  cardId: string
  userId: string
  createdAt: string
}

export interface VoteSession {
  id: string
  boardId: string
  status: 'ACTIVE' | 'CLOSED'
  votesPerPerson: number
  timerSeconds: number | null
  timerEndsAt: string | null
  voterIds: string[]
  votes: BoardVote[]
  createdAt: string
  closedAt: string | null
}

export const CARD_COLORS = ['#FEF08A', '#86EFAC', '#93C5FD', '#F9A8D4', '#FCA5A5', '#C4B5FD']

// Group ring colors drawn from the shared BASE_COLORS pastel palette.
export const GROUP_COLORS = ['#FCA5A5', '#FDBA74', '#86EFAC', '#7DD3FC', '#93C5FD', '#C4B5FD', '#F9A8D4'] as const

export function groupColor(groupId: string): string {
  let hash = 0
  for (let i = 0; i < groupId.length; i++) hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0
  return GROUP_COLORS[hash % GROUP_COLORS.length]
}
