export type CardType = 'TEXT' | 'IMAGE' | 'LINK'

export interface Card {
  id: string
  boardId: string
  type: CardType
  content: string
  posX: number
  posY: number
  color: string
  authorId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Board {
  id: string
  name: string
  description: string | null
  ownerId: string
  createdAt: Date
  updatedAt: Date
  cards?: Card[]
}
