import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'

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
  fieldValues: FieldValue[]
}

export interface Connection {
  id: string
  boardId: string
  fromId: string
  toId: string
}

export interface Frame {
  id: string
  boardId: string
  title: string
  posX: number
  posY: number
  width: number
  height: number
  color: string
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
  cards: Card[]
}

const CARD_COLORS = ['#FEF08A', '#86EFAC', '#93C5FD', '#F9A8D4', '#FCA5A5', '#C4B5FD']
export const GROUP_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

export function groupColor(groupId: string): string {
  let hash = 0
  for (let i = 0; i < groupId.length; i++) hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0
  return GROUP_COLORS[hash % GROUP_COLORS.length]
}

export function useBoard(boardId: string) {
  const [board, setBoard] = useState<BoardDetail | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [frames, setFrames] = useState<Frame[]>([])
  const [fields, setFields] = useState<BoardField[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const socketRef = useRef(connectSocket())
  const cardsRef = useRef<Card[]>([])
  cardsRef.current = cards
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds

  useEffect(() => {
    api.get<BoardDetail>(`/api/boards/${boardId}`).then((data) => {
      setBoard(data)
      setCards(data.cards.map((c) => ({ ...c, fieldValues: (c as Card).fieldValues ?? [] })))
      setIsLoading(false)
    })

    const socket = socketRef.current
    socket.emit('board:join', boardId)

    socket.on('board:state', ({ cards: sc, connections: sconn, frames: sf, fields: sfields }) => {
      setCards(sc as Card[])
      setConnections(sconn as Connection[])
      setFrames(sf as Frame[])
      setFields((sfields as BoardField[]).map((f) => ({ ...f, options: f.options as string[] | null })))
    })

    // Cards
    socket.on('card:created', (card) => setCards((prev) => [...prev, { ...(card as Card), fieldValues: [] }]))
    socket.on('card:moved', (card) => setCards((prev) => prev.map((c) => c.id === (card as Card).id ? { ...c, ...(card as Card) } : c)))
    socket.on('card:resized', (card) => setCards((prev) => prev.map((c) => c.id === (card as Card).id ? { ...c, ...(card as Card) } : c)))
    socket.on('card:updated', (card) => setCards((prev) => prev.map((c) => c.id === (card as Card).id ? { ...c, ...(card as Card) } : c)))
    socket.on('card:deleted', (id) => {
      setCards((prev) => prev.filter((c) => c.id !== id))
      setConnections((prev) => prev.filter((c) => c.fromId !== id && c.toId !== id))
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id as string); return next })
    })
    socket.on('card:recolored', (card) => setCards((prev) => prev.map((c) => c.id === (card as Card).id ? { ...c, ...(card as Card) } : c)))

    // Groups
    socket.on('cards:grouped', ({ cardIds, groupId }: { cardIds: string[]; groupId: string }) => {
      setCards((prev) => prev.map((c) => cardIds.includes(c.id) ? { ...c, groupId } : c))
    })
    socket.on('cards:ungrouped', (groupId: string) => {
      setCards((prev) => prev.map((c) => c.groupId === groupId ? { ...c, groupId: null } : c))
    })

    // Connections
    socket.on('connection:created', (conn) => setConnections((prev) => [...prev, conn as Connection]))
    socket.on('connection:deleted', (id) => setConnections((prev) => prev.filter((c) => c.id !== id)))

    // Frames
    socket.on('frame:created', (frame) => setFrames((prev) => [...prev, frame as Frame]))
    socket.on('frame:moved', (frame) => setFrames((prev) => prev.map((f) => f.id === (frame as Frame).id ? { ...f, ...(frame as Frame) } : f)))
    socket.on('frame:resized', (frame) => setFrames((prev) => prev.map((f) => f.id === (frame as Frame).id ? { ...f, ...(frame as Frame) } : f)))
    socket.on('frame:updated', (frame) => setFrames((prev) => prev.map((f) => f.id === (frame as Frame).id ? { ...f, ...(frame as Frame) } : f)))
    socket.on('frame:deleted', (id) => setFrames((prev) => prev.filter((f) => f.id !== id)))

    // Board fields
    socket.on('boardfield:created', (field) => setFields((prev) => [...prev, { ...(field as BoardField), options: (field as BoardField).options as string[] | null }]))
    socket.on('boardfield:updated', (field) => setFields((prev) => prev.map((f) => f.id === (field as BoardField).id ? { ...f, ...(field as BoardField), options: (field as BoardField).options as string[] | null } : f)))
    socket.on('boardfield:deleted', (id) => setFields((prev) => prev.filter((f) => f.id !== id)))

    // Card field values
    socket.on('cardfield:updated', (fv: FieldValue) => {
      setCards((prev) => prev.map((c) => {
        if (c.id !== fv.cardId) return c
        const exists = c.fieldValues.find((v) => v.fieldId === fv.fieldId)
        return {
          ...c,
          fieldValues: exists
            ? c.fieldValues.map((v) => v.fieldId === fv.fieldId ? fv : v)
            : [...c.fieldValues, fv],
        }
      }))
    })
    socket.on('cardfield:cleared', ({ cardId, fieldId }: { cardId: string; fieldId: string }) => {
      setCards((prev) => prev.map((c) => c.id !== cardId ? c : { ...c, fieldValues: c.fieldValues.filter((v) => v.fieldId !== fieldId) }))
    })

    return () => {
      socket.emit('board:leave', boardId)
      ;['board:state',
        'card:created', 'card:moved', 'card:resized', 'card:updated', 'card:deleted', 'card:recolored',
        'cards:grouped', 'cards:ungrouped',
        'connection:created', 'connection:deleted',
        'frame:created', 'frame:moved', 'frame:resized', 'frame:updated', 'frame:deleted',
        'boardfield:created', 'boardfield:updated', 'boardfield:deleted',
        'cardfield:updated', 'cardfield:cleared',
      ].forEach((e) => socket.off(e))
    }
  }, [boardId])

  // ── Cards ─────────────────────────────────────────────────────────────────────
  function addCard(posX: number, posY: number, type?: string, content?: string, color?: string, width?: number, height?: number) {
    const cardColor = color ?? CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)]
    const extra: Record<string, number> = {}
    if (width !== undefined) extra.width = width
    if (height !== undefined) extra.height = height
    socketRef.current.emit('card:create', { boardId, content: content ?? '', posX, posY, color: cardColor, type: type ?? 'TEXT', ...extra })
  }

  function moveCard(id: string, posX: number, posY: number) {
    const card = cardsRef.current.find((c) => c.id === id)
    if (!card) return
    const dx = posX - card.posX
    const dy = posY - card.posY

    setCards((prev) => prev.map((c) => {
      if (c.id === id) return { ...c, posX, posY }
      if (card.groupId && c.groupId === card.groupId) return { ...c, posX: c.posX + dx, posY: c.posY + dy }
      return c
    }))

    socketRef.current.emit('card:move', { id, boardId, posX, posY })
    if (card.groupId) {
      cardsRef.current
        .filter((c) => c.groupId === card.groupId && c.id !== id)
        .forEach((c) => socketRef.current.emit('card:move', { id: c.id, boardId, posX: c.posX + dx, posY: c.posY + dy }))
    }
  }

  function resizeCard(id: string, width: number, height: number) {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, width, height } : c))
    socketRef.current.emit('card:resize', { id, boardId, width, height })
  }

  function updateCard(id: string, content: string) {
    socketRef.current.emit('card:update', { id, boardId, content })
  }

  function deleteCard(id: string) {
    socketRef.current.emit('card:delete', { id, boardId })
  }

  function recolorCard(id: string, color: string) {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, color } : c))
    socketRef.current.emit('card:recolor', { id, boardId, color })
  }

  function recolorSelected(color: string) {
    selectedIdsRef.current.forEach((id) => {
      setCards((prev) => prev.map((c) => c.id === id ? { ...c, color } : c))
      socketRef.current.emit('card:recolor', { id, boardId, color })
    })
  }

  function deleteSelected() {
    selectedIdsRef.current.forEach((id) => socketRef.current.emit('card:delete', { id, boardId }))
    setSelectedIds(new Set())
  }

  // ── Groups ────────────────────────────────────────────────────────────────────
  function groupSelected() {
    const ids = Array.from(selectedIdsRef.current)
    if (ids.length < 2) return
    const selectedCards = cardsRef.current.filter((c) => ids.includes(c.id))
    const groupIds = new Set(selectedCards.map((c) => c.groupId).filter(Boolean))
    if (groupIds.size === 1 && selectedCards.every((c) => c.groupId !== null)) {
      socketRef.current.emit('cards:ungroup', { boardId, groupId: Array.from(groupIds)[0] })
    } else {
      socketRef.current.emit('cards:group', { boardId, cardIds: ids })
    }
  }

  // ── Connections ───────────────────────────────────────────────────────────────
  function addConnection(fromId: string, toId: string) {
    socketRef.current.emit('connection:create', { boardId, fromId, toId })
  }

  function deleteConnection(id: string) {
    socketRef.current.emit('connection:delete', { id, boardId })
  }

  // ── Frames ────────────────────────────────────────────────────────────────────
  function addFrame(posX: number, posY: number) {
    socketRef.current.emit('frame:create', { boardId, posX, posY })
  }

  function moveFrame(id: string, posX: number, posY: number, capturedCards: { id: string; startX: number; startY: number; frameStartX: number; frameStartY: number }[]) {
    setFrames((prev) => prev.map((f) => f.id === id ? { ...f, posX, posY } : f))
    socketRef.current.emit('frame:move', { id, boardId, posX, posY })

    if (capturedCards.length === 0) return
    const { frameStartX, frameStartY } = capturedCards[0]
    const dx = posX - frameStartX
    const dy = posY - frameStartY

    setCards((prev) => prev.map((c) => {
      const cap = capturedCards.find((cc) => cc.id === c.id)
      if (!cap) return c
      const newX = cap.startX + dx
      const newY = cap.startY + dy
      socketRef.current.emit('card:move', { id: c.id, boardId, posX: newX, posY: newY })
      return { ...c, posX: newX, posY: newY }
    }))
  }

  function resizeFrame(id: string, width: number, height: number) {
    setFrames((prev) => prev.map((f) => f.id === id ? { ...f, width, height } : f))
    socketRef.current.emit('frame:resize', { id, boardId, width, height })
  }

  function updateFrame(id: string, title: string) {
    socketRef.current.emit('frame:update', { id, boardId, title })
  }

  function deleteFrame(id: string) {
    socketRef.current.emit('frame:delete', { id, boardId })
  }

  // ── Board fields ──────────────────────────────────────────────────────────────
  function createField(name: string, type: string, options?: string[], emoji?: string) {
    socketRef.current.emit('boardfield:create', { boardId, name, emoji: emoji ?? null, type, options: options ?? null, order: fields.length })
  }

  function updateField(id: string, name: string, options?: string[], emoji?: string) {
    socketRef.current.emit('boardfield:update', { id, boardId, name, emoji: emoji ?? null, options: options ?? null })
  }

  function deleteField(id: string) {
    socketRef.current.emit('boardfield:delete', { id, boardId })
  }

  // ── Card field values ─────────────────────────────────────────────────────────
  function setFieldValue(cardId: string, fieldId: string, value: string) {
    if (value.trim() === '') {
      socketRef.current.emit('cardfield:clear', { boardId, cardId, fieldId })
    } else {
      socketRef.current.emit('cardfield:set', { boardId, cardId, fieldId, value: value.trim() })
    }
  }

  function clearFieldValue(cardId: string, fieldId: string) {
    socketRef.current.emit('cardfield:clear', { boardId, cardId, fieldId })
  }

  const selectCards = useCallback((ids: Set<string>) => setSelectedIds(ids), [])

  return {
    board, cards, connections, frames, fields, selectedIds, isLoading,
    addCard, moveCard, resizeCard, updateCard, deleteCard, deleteSelected, recolorCard, recolorSelected,
    groupSelected,
    addConnection, deleteConnection,
    addFrame, moveFrame, resizeFrame, updateFrame, deleteFrame,
    createField, updateField, deleteField,
    setFieldValue, clearFieldValue,
    selectCards,
  }
}
