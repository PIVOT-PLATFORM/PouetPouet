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

// ── History ────────────────────────────────────────────────────────────────────
const HISTORY_LIMIT = 30

interface HistoryEntry {
  undo: () => void
  redo: () => void
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
  const framesRef = useRef<Frame[]>([])
  framesRef.current = frames
  const connectionsRef = useRef<Connection[]>([])
  connectionsRef.current = connections
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds

  // ── History refs ────────────────────────────────────────────────────────────
  const undoStackRef = useRef<HistoryEntry[]>([])
  const redoStackRef = useRef<HistoryEntry[]>([])
  const [, setHistoryVersion] = useState(0)
  // Queues for async server-assigned IDs (card:created / frame:created)
  const pendingCardHistoryRef = useRef<Array<(card: Card) => void>>([])
  const pendingFrameHistoryRef = useRef<Array<(frame: Frame) => void>>([])
  // Start positions for drag/resize (pushed to history only on commit)
  const cardDragStartRef = useRef<Map<string, { posX: number; posY: number }> | null>(null)
  const cardResizeStartRef = useRef<{ id: string; width: number; height: number } | null>(null)
  const frameDragStartRef = useRef<{
    frameId: string
    framePos: { posX: number; posY: number }
    cardPositions: Map<string, { posX: number; posY: number }>
  } | null>(null)
  const frameResizeStartRef = useRef<{ id: string; width: number; height: number } | null>(null)

  function bumpHistory() { setHistoryVersion((v) => v + 1) }

  function pushHistory(entry: HistoryEntry) {
    undoStackRef.current = [...undoStackRef.current.slice(-(HISTORY_LIMIT - 1)), entry]
    redoStackRef.current = []
    bumpHistory()
  }

  function undo() {
    const entry = undoStackRef.current.pop()
    if (!entry) return
    redoStackRef.current.push(entry)
    entry.undo()
    bumpHistory()
  }

  function redo() {
    const entry = redoStackRef.current.pop()
    if (!entry) return
    undoStackRef.current.push(entry)
    entry.redo()
    bumpHistory()
  }

  // Derived from refs — stable after bumpHistory
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canUndo = undoStackRef.current.length > 0
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canRedo = redoStackRef.current.length > 0

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

    // Cards — process pending history callback before updating state
    socket.on('card:created', (card) => {
      const cb = pendingCardHistoryRef.current.shift()
      cb?.(card as Card)
      setCards((prev) => [...prev, { ...(card as Card), fieldValues: [] }])
    })
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

    // Frames — process pending history callback before updating state
    socket.on('frame:created', (frame) => {
      const cb = pendingFrameHistoryRef.current.shift()
      cb?.(frame as Frame)
      setFrames((prev) => [...prev, frame as Frame])
    })
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
    const emitParams = { boardId, content: content ?? '', posX, posY, color: cardColor, type: type ?? 'TEXT', ...extra }

    // After server confirms the new ID, register the undo entry
    pendingCardHistoryRef.current.push((card: Card) => {
      let trackedId = card.id
      pushHistory({
        undo: () => socketRef.current.emit('card:delete', { id: trackedId, boardId }),
        redo: () => {
          socketRef.current.emit('card:create', emitParams)
          pendingCardHistoryRef.current.push((newCard: Card) => { trackedId = newCard.id })
        },
      })
    })

    socketRef.current.emit('card:create', emitParams)
  }

  function moveCard(id: string, posX: number, posY: number) {
    const card = cardsRef.current.find((c) => c.id === id)
    if (!card) return
    const dx = posX - card.posX
    const dy = posY - card.posY

    const selected = selectedIdsRef.current
    const useSelection = selected.size > 1 && selected.has(id)
    const followIds = new Set<string>()
    if (card.groupId) {
      cardsRef.current.forEach((c) => { if (c.groupId === card.groupId && c.id !== id) followIds.add(c.id) })
    }
    if (useSelection) {
      selected.forEach((sid) => { if (sid !== id) followIds.add(sid) })
    }

    setCards((prev) => prev.map((c) => {
      if (c.id === id) return { ...c, posX, posY }
      if (followIds.has(c.id)) return { ...c, posX: c.posX + dx, posY: c.posY + dy }
      return c
    }))

    socketRef.current.emit('card:move', { id, boardId, posX, posY })
    followIds.forEach((fid) => {
      const c = cardsRef.current.find((cc) => cc.id === fid)
      if (c) socketRef.current.emit('card:move', { id: fid, boardId, posX: c.posX + dx, posY: c.posY + dy })
    })
  }

  // Called at drag START — captures positions of all cards that will move together
  function startDragCard(id: string) {
    const card = cardsRef.current.find((c) => c.id === id)
    if (!card) return
    const selected = selectedIdsRef.current
    const useSelection = selected.size > 1 && selected.has(id)
    const movedIds = new Set<string>([id])
    if (card.groupId) cardsRef.current.forEach((c) => { if (c.groupId === card.groupId) movedIds.add(c.id) })
    if (useSelection) selected.forEach((sid) => movedIds.add(sid))
    cardDragStartRef.current = new Map(
      Array.from(movedIds).flatMap((cid) => {
        const c = cardsRef.current.find((cc) => cc.id === cid)
        return c ? [[cid, { posX: c.posX, posY: c.posY }]] : []
      })
    )
  }

  // Called at drag END — compares start vs end positions and pushes undo entry if moved
  function commitDragCard(_id: string) {
    const starts = cardDragStartRef.current
    cardDragStartRef.current = null
    if (!starts) return
    const ends = new Map<string, { posX: number; posY: number }>()
    starts.forEach((_, cid) => {
      const c = cardsRef.current.find((cc) => cc.id === cid)
      if (c) ends.set(cid, { posX: c.posX, posY: c.posY })
    })
    let hasMoved = false
    starts.forEach((start, cid) => {
      const end = ends.get(cid)
      if (end && (Math.abs(end.posX - start.posX) > 0.5 || Math.abs(end.posY - start.posY) > 0.5)) hasMoved = true
    })
    if (!hasMoved) return
    pushHistory({
      undo: () => {
        starts.forEach(({ posX, posY }, cid) => {
          setCards((prev) => prev.map((c) => c.id === cid ? { ...c, posX, posY } : c))
          socketRef.current.emit('card:move', { id: cid, boardId, posX, posY })
        })
      },
      redo: () => {
        ends.forEach(({ posX, posY }, cid) => {
          setCards((prev) => prev.map((c) => c.id === cid ? { ...c, posX, posY } : c))
          socketRef.current.emit('card:move', { id: cid, boardId, posX, posY })
        })
      },
    })
  }

  function resizeCard(id: string, width: number, height: number) {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, width, height } : c))
    socketRef.current.emit('card:resize', { id, boardId, width, height })
  }

  function startResizeCard(id: string) {
    const card = cardsRef.current.find((c) => c.id === id)
    if (!card) return
    cardResizeStartRef.current = { id, width: card.width, height: card.height }
  }

  function commitResizeCard(id: string) {
    const start = cardResizeStartRef.current
    cardResizeStartRef.current = null
    if (!start || start.id !== id) return
    const card = cardsRef.current.find((c) => c.id === id)
    if (!card) return
    const { width: oldW, height: oldH } = start
    const { width: newW, height: newH } = card
    if (Math.abs(newW - oldW) < 0.5 && Math.abs(newH - oldH) < 0.5) return
    pushHistory({
      undo: () => {
        setCards((prev) => prev.map((c) => c.id === id ? { ...c, width: oldW, height: oldH } : c))
        socketRef.current.emit('card:resize', { id, boardId, width: oldW, height: oldH })
      },
      redo: () => {
        setCards((prev) => prev.map((c) => c.id === id ? { ...c, width: newW, height: newH } : c))
        socketRef.current.emit('card:resize', { id, boardId, width: newW, height: newH })
      },
    })
  }

  function updateCard(id: string, content: string) {
    // cardsRef holds the last server-confirmed content — perfect as "old" value for undo
    const oldContent = cardsRef.current.find((c) => c.id === id)?.content ?? ''
    if (oldContent === content) return
    pushHistory({
      undo: () => socketRef.current.emit('card:update', { id, boardId, content: oldContent }),
      redo: () => socketRef.current.emit('card:update', { id, boardId, content }),
    })
    socketRef.current.emit('card:update', { id, boardId, content })
  }

  function deleteCard(id: string) {
    const card = cardsRef.current.find((c) => c.id === id)
    if (!card) return
    const saved = { ...card }
    let trackedId = id
    pushHistory({
      undo: () => {
        const params = { boardId, content: saved.content, posX: saved.posX, posY: saved.posY, color: saved.color, type: saved.type, width: saved.width, height: saved.height }
        socketRef.current.emit('card:create', params)
        pendingCardHistoryRef.current.push((newCard: Card) => { trackedId = newCard.id })
      },
      redo: () => socketRef.current.emit('card:delete', { id: trackedId, boardId }),
    })
    socketRef.current.emit('card:delete', { id, boardId })
  }

  function recolorCard(id: string, color: string) {
    const oldColor = cardsRef.current.find((c) => c.id === id)?.color ?? ''
    pushHistory({
      undo: () => {
        setCards((prev) => prev.map((c) => c.id === id ? { ...c, color: oldColor } : c))
        socketRef.current.emit('card:recolor', { id, boardId, color: oldColor })
      },
      redo: () => {
        setCards((prev) => prev.map((c) => c.id === id ? { ...c, color } : c))
        socketRef.current.emit('card:recolor', { id, boardId, color })
      },
    })
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, color } : c))
    socketRef.current.emit('card:recolor', { id, boardId, color })
  }

  function recolorSelected(color: string) {
    const ids = Array.from(selectedIdsRef.current)
    const oldColors = new Map(ids.map((id) => {
      const c = cardsRef.current.find((cc) => cc.id === id)
      return [id, c?.color ?? ''] as [string, string]
    }))
    pushHistory({
      undo: () => {
        oldColors.forEach((oldColor, id) => {
          setCards((prev) => prev.map((c) => c.id === id ? { ...c, color: oldColor } : c))
          socketRef.current.emit('card:recolor', { id, boardId, color: oldColor })
        })
      },
      redo: () => {
        ids.forEach((id) => {
          setCards((prev) => prev.map((c) => c.id === id ? { ...c, color } : c))
          socketRef.current.emit('card:recolor', { id, boardId, color })
        })
      },
    })
    ids.forEach((id) => {
      setCards((prev) => prev.map((c) => c.id === id ? { ...c, color } : c))
      socketRef.current.emit('card:recolor', { id, boardId, color })
    })
  }

  function deleteSelected() {
    const ids = Array.from(selectedIdsRef.current)
    const savedCards = ids.map((id) => cardsRef.current.find((c) => c.id === id)).filter(Boolean) as Card[]
    if (savedCards.length === 0) return
    // trackedIds[i] follows the live ID through undo/redo cycles
    const trackedIds = savedCards.map((c) => c.id)
    pushHistory({
      undo: () => {
        savedCards.forEach((card, i) => {
          const params = { boardId, content: card.content, posX: card.posX, posY: card.posY, color: card.color, type: card.type, width: card.width, height: card.height }
          socketRef.current.emit('card:create', params)
          pendingCardHistoryRef.current.push((newCard: Card) => { trackedIds[i] = newCard.id })
        })
      },
      redo: () => {
        trackedIds.forEach((id) => socketRef.current.emit('card:delete', { id, boardId }))
      },
    })
    ids.forEach((id) => socketRef.current.emit('card:delete', { id, boardId }))
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
    const emitParams = { boardId, posX, posY }
    pendingFrameHistoryRef.current.push((frame: Frame) => {
      let trackedId = frame.id
      pushHistory({
        undo: () => socketRef.current.emit('frame:delete', { id: trackedId, boardId }),
        redo: () => {
          socketRef.current.emit('frame:create', emitParams)
          pendingFrameHistoryRef.current.push((newFrame: Frame) => { trackedId = newFrame.id })
        },
      })
    })
    socketRef.current.emit('frame:create', emitParams)
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

  function startDragFrame(id: string, capturedCardIds: string[]) {
    const frame = framesRef.current.find((f) => f.id === id)
    if (!frame) return
    frameDragStartRef.current = {
      frameId: id,
      framePos: { posX: frame.posX, posY: frame.posY },
      cardPositions: new Map(
        capturedCardIds.flatMap((cid) => {
          const c = cardsRef.current.find((cc) => cc.id === cid)
          return c ? [[cid, { posX: c.posX, posY: c.posY }]] : []
        })
      ),
    }
  }

  function commitDragFrame(id: string) {
    const start = frameDragStartRef.current
    frameDragStartRef.current = null
    if (!start || start.frameId !== id) return
    const frame = framesRef.current.find((f) => f.id === id)
    if (!frame) return
    const { framePos: oldPos, cardPositions: oldCardPos } = start
    const newPos = { posX: frame.posX, posY: frame.posY }
    if (Math.abs(newPos.posX - oldPos.posX) < 0.5 && Math.abs(newPos.posY - oldPos.posY) < 0.5) return
    const newCardPositions = new Map<string, { posX: number; posY: number }>()
    oldCardPos.forEach((_, cid) => {
      const c = cardsRef.current.find((cc) => cc.id === cid)
      if (c) newCardPositions.set(cid, { posX: c.posX, posY: c.posY })
    })
    pushHistory({
      undo: () => {
        setFrames((prev) => prev.map((f) => f.id === id ? { ...f, ...oldPos } : f))
        socketRef.current.emit('frame:move', { id, boardId, ...oldPos })
        oldCardPos.forEach(({ posX, posY }, cid) => {
          setCards((prev) => prev.map((c) => c.id === cid ? { ...c, posX, posY } : c))
          socketRef.current.emit('card:move', { id: cid, boardId, posX, posY })
        })
      },
      redo: () => {
        setFrames((prev) => prev.map((f) => f.id === id ? { ...f, ...newPos } : f))
        socketRef.current.emit('frame:move', { id, boardId, ...newPos })
        newCardPositions.forEach(({ posX, posY }, cid) => {
          setCards((prev) => prev.map((c) => c.id === cid ? { ...c, posX, posY } : c))
          socketRef.current.emit('card:move', { id: cid, boardId, posX, posY })
        })
      },
    })
  }

  function resizeFrame(id: string, width: number, height: number) {
    setFrames((prev) => prev.map((f) => f.id === id ? { ...f, width, height } : f))
    socketRef.current.emit('frame:resize', { id, boardId, width, height })
  }

  function startResizeFrame(id: string) {
    const frame = framesRef.current.find((f) => f.id === id)
    if (!frame) return
    frameResizeStartRef.current = { id, width: frame.width, height: frame.height }
  }

  function commitResizeFrame(id: string) {
    const start = frameResizeStartRef.current
    frameResizeStartRef.current = null
    if (!start || start.id !== id) return
    const frame = framesRef.current.find((f) => f.id === id)
    if (!frame) return
    const { width: oldW, height: oldH } = start
    const { width: newW, height: newH } = frame
    if (Math.abs(newW - oldW) < 0.5 && Math.abs(newH - oldH) < 0.5) return
    pushHistory({
      undo: () => {
        setFrames((prev) => prev.map((f) => f.id === id ? { ...f, width: oldW, height: oldH } : f))
        socketRef.current.emit('frame:resize', { id, boardId, width: oldW, height: oldH })
      },
      redo: () => {
        setFrames((prev) => prev.map((f) => f.id === id ? { ...f, width: newW, height: newH } : f))
        socketRef.current.emit('frame:resize', { id, boardId, width: newW, height: newH })
      },
    })
  }

  function updateFrame(id: string, title: string) {
    const oldTitle = framesRef.current.find((f) => f.id === id)?.title ?? ''
    if (oldTitle === title) return
    pushHistory({
      undo: () => socketRef.current.emit('frame:update', { id, boardId, title: oldTitle }),
      redo: () => socketRef.current.emit('frame:update', { id, boardId, title }),
    })
    socketRef.current.emit('frame:update', { id, boardId, title })
  }

  function deleteFrame(id: string) {
    const frame = framesRef.current.find((f) => f.id === id)
    if (!frame) return
    const saved = { ...frame }
    let trackedId = id
    pushHistory({
      undo: () => {
        socketRef.current.emit('frame:create', { boardId, posX: saved.posX, posY: saved.posY })
        pendingFrameHistoryRef.current.push((newFrame: Frame) => { trackedId = newFrame.id })
      },
      redo: () => socketRef.current.emit('frame:delete', { id: trackedId, boardId }),
    })
    socketRef.current.emit('frame:delete', { id, boardId })
  }

  // ── Reset ─────────────────────────────────────────────────────────────────────
  function resetBoard() {
    cardsRef.current.forEach((c) => socketRef.current.emit('card:delete', { id: c.id, boardId }))
    connectionsRef.current.forEach((c) => socketRef.current.emit('connection:delete', { id: c.id, boardId }))
    framesRef.current.forEach((f) => socketRef.current.emit('frame:delete', { id: f.id, boardId }))
    setSelectedIds(new Set())
    // Clear history — post-reset state is the new baseline
    undoStackRef.current = []
    redoStackRef.current = []
    bumpHistory()
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
    startDragCard, commitDragCard, startResizeCard, commitResizeCard,
    groupSelected,
    addConnection, deleteConnection,
    addFrame, moveFrame, resizeFrame, updateFrame, deleteFrame,
    startDragFrame, commitDragFrame, startResizeFrame, commitResizeFrame,
    createField, updateField, deleteField,
    setFieldValue, clearFieldValue,
    selectCards,
    undo, redo, canUndo, canRedo,
    resetBoard,
  }
}
