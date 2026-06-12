import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'

import { DEFAULT_CARD_COLOR } from '@/lib/colors'
import type {
  FieldValue, Card, Connection, ConnectionPatch, Frame, BoardField, BoardDetail,
  PresenceUser, BoardMember, VoteSession,
} from './board-types'

// Re-export the data model so existing importers of '@/hooks/useBoard' keep working.
export type {
  FieldValue, Card, Connection, ConnectionPatch, ConnShape, ConnArrow, Frame, BoardField, BoardDetail,
  PresenceUser, BoardMember, BoardVote, VoteSession,
} from './board-types'
export { groupColor, GROUP_COLORS } from './board-types'

export interface ClipboardCard {
  type: string
  content: string
  color: string
  posX: number
  posY: number
  width: number
  height: number
  layer: number
  groupId: string | null
  groupColor: string | null
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
  const [importCount, setImportCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<'OWNER' | 'EDITOR' | 'VIEWER' | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [presence, setPresence] = useState<PresenceUser[]>([])
  const [members, setMembers] = useState<BoardMember[]>([])
  const [cursors, setCursors] = useState<Map<string, { name: string; avatar: string | null; x: number; y: number; ts: number }>>(new Map())
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null)
  const [activeVoteSession, setActiveVoteSession] = useState<VoteSession | null>(null)
  const [lastVoteSession, setLastVoteSession] = useState<VoteSession | null>(null)
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
  // Tags des créations locales en attente : seule la carte créée par CE client
  // s'ouvre en édition au montage (sinon une création distante vole le focus).
  const pendingLocalTagsRef = useRef<Set<string>>(new Set())
  const autoEditCardIdRef = useRef<string | null>(null)
  // Queues for async server-assigned IDs (card:created / frame:created)
  const pendingCardHistoryRef = useRef<Array<(card: Card) => void>>([])
  const pendingConnHistoryRef = useRef<Array<(conn: Connection) => void>>([])
  const pendingFrameHistoryRef = useRef<Array<(frame: Frame) => void>>([])
  const pendingGroupHistoryRef = useRef<Array<(groupId: string) => void>>([])

  // Start positions for drag/resize (pushed to history only on commit)
  const cardDragStartRef = useRef<Map<string, { posX: number; posY: number }> | null>(null)
  // Coalesces card:move socket emits to at most one batch per animation frame.
  const moveEmitRef = useRef<{ raf: number | null; pending: Map<string, { posX: number; posY: number }> }>({ raf: null, pending: new Map() })
  const cardResizeStartRef = useRef<{ id: string; posX: number; posY: number; width: number; height: number } | null>(null)
  const frameDragStartRef = useRef<{
    frameId: string
    framePos: { posX: number; posY: number }
    cardPositions: Map<string, { posX: number; posY: number }>
  } | null>(null)
  const frameResizeStartRef = useRef<{ id: string; posX: number; posY: number; width: number; height: number } | null>(null)

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
  const canUndo = undoStackRef.current.length > 0
  const canRedo = redoStackRef.current.length > 0

  useEffect(() => {
    api.get<BoardDetail & { role: 'OWNER' | 'EDITOR' | 'VIEWER' }>(`/api/boards/${boardId}`)
      .then((data) => {
        setBoard(data)
        setCards(data.cards.map((c) => ({ ...c, fieldValues: (c as Card).fieldValues ?? [] })))
        setUserRole(data.role)
        setIsLoading(false)
        // HTTP is authoritative: if the API confirms access, clear any transient socket error.
        setAccessDenied(false)
      })
      .catch((err: Error) => {
        if (err.message === 'Accès refusé') setAccessDenied(true)
        setIsLoading(false)
      })

    api.get<BoardMember[]>(`/api/boards/${boardId}/members`)
      .then(setMembers)
      .catch(() => {})

    api.get<VoteSession | null>(`/api/boards/${boardId}/vote/current`)
      .then((s) => { if (s) setActiveVoteSession(s) })
      .catch(() => {})

    api.get<VoteSession | null>(`/api/boards/${boardId}/vote/last`)
      .then((s) => { if (s) setLastVoteSession(s) })
      .catch(() => {})

    const socket = socketRef.current
    socket.emit('board:join', boardId)

    // On reconnect the server clears all rooms and socket.data — re-join to restore state.
    // Use socket.io (the Manager) so this fires on reconnections only, not the initial connect.
    const handleReconnect = () => socket.emit('board:join', boardId)
    socket.io.on('reconnect', handleReconnect)

    socket.on('board:state', ({ cards: sc, connections: sconn, frames: sf, fields: sfields, role }) => {
      setCards(sc as Card[])
      setConnections(sconn as Connection[])
      setFrames(sf as Frame[])
      setFields((sfields as BoardField[]).map((f) => ({ ...f, options: f.options as string[] | null })))
      if (role) setUserRole(role as 'OWNER' | 'EDITOR' | 'VIEWER')
    })

    socket.on('board:imported', ({ cards: ic, connections: iconn }: { cards: Card[]; connections: Connection[] }) => {
      setCards((prev) => [...prev, ...ic.map((c) => ({ ...c, fieldValues: [] }))])
      setConnections((prev) => [...prev, ...iconn])
      setImportCount((n) => n + 1)
    })

    socket.on('board:error', (msg: string) => {
      if (msg === 'Accès refusé') setAccessDenied(true)
    })

    socket.on('board:presence', (users: PresenceUser[]) => {
      setPresence(users)
      // Remove cursors for users who left the board
      const activeIds = new Set(users.map((u) => u.id))
      setCursors((prev) => {
        const next = new Map(prev)
        for (const uid of next.keys()) {
          if (!activeIds.has(uid)) next.delete(uid)
        }
        return next
      })
    })

    // Batch 20 Hz côté serveur : un seul setState par tick quel que soit le
    // nombre de participants (vs un render par curseur reçu auparavant).
    socket.on('board:cursors', (batch: { userId: string; name: string; avatar: string | null; x: number; y: number }[]) => {
      const now = Date.now()
      setCursors((prev) => {
        const next = new Map(prev)
        for (const c of batch) {
          next.set(c.userId, { name: c.name, avatar: c.avatar, x: c.x, y: c.y, ts: now })
        }
        return next
      })
    })

    socket.on('timer:started', ({ endsAt }: { endsAt: number }) => setTimerEndsAt(endsAt))
    socket.on('timer:stopped', () => setTimerEndsAt(null))

    socket.on('vote:session:started', (session: VoteSession) => setActiveVoteSession(session))
    socket.on('vote:updated', (session: VoteSession) => setActiveVoteSession(session))
    socket.on('vote:session:closed', (session: VoteSession) => {
      setActiveVoteSession(null)
      setLastVoteSession(session)
    })

    socket.on('cards:locked', ({ ids, locked }: { ids: string[]; locked: boolean }) => {
      setCards((prev) => prev.map((c) => ids.includes(c.id) ? { ...c, locked } : c))
    })
    socket.on('card:layered', ({ id, layer }: { id: string; layer: number }) => {
      setCards((prev) => prev.map((c) => c.id === id ? { ...c, layer } : c))
    })
    socket.on('frame:layered', ({ id, layer }: { id: string; layer: number }) => {
      setFrames((prev) => prev.map((f) => f.id === id ? { ...f, layer } : f))
    })

    // Cards — process pending history callback before updating state
    socket.on('card:created', (payload) => {
      const { clientTag, ...card } = payload as Card & { clientTag?: string }
      if (clientTag && pendingLocalTagsRef.current.delete(clientTag)) {
        autoEditCardIdRef.current = card.id
      }
      const cb = pendingCardHistoryRef.current.shift()
      cb?.(card as Card)
      setCards((prev) => [...prev, { ...(card as Card), fieldValues: [] }])
    })
    socket.on('card:moved', (card) => setCards((prev) => prev.map((c) => c.id === (card as Card).id ? { ...c, ...(card as Card) } : c)))
    socket.on('card:resized', (card) => setCards((prev) => prev.map((c) => c.id === (card as Card).id ? { ...c, ...(card as Card) } : c)))
    // card:update only ever changes `content`. Its echo (io.to) returns to the sender too,
    // so we must NOT apply the payload's geometry — doing so would clobber a freshly
    // grown height (e.g. a TEXT card that auto-expanded) with a stale racing value.
    socket.on('card:updated', (card) => setCards((prev) => prev.map((c) => {
      if (c.id !== (card as Card).id) return c
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { posX, posY, width, height, ...rest } = card as Card
      return { ...c, ...rest }
    })))
    socket.on('card:deleted', (id) => {
      setCards((prev) => prev.filter((c) => c.id !== id))
      setConnections((prev) => prev.filter((c) => c.fromId !== id && c.toId !== id))
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id as string); return next })
    })
    socket.on('card:recolored', (card) => setCards((prev) => prev.map((c) => c.id === (card as Card).id ? { ...c, ...(card as Card) } : c)))

    // Groups
    socket.on('cards:grouped', ({ cardIds, groupId }: { cardIds: string[]; groupId: string }) => {
      const cb = pendingGroupHistoryRef.current.shift()
      cb?.(groupId)
      setCards((prev) => prev.map((c) => cardIds.includes(c.id) ? { ...c, groupId } : c))
    })
    socket.on('cards:ungrouped', (groupId: string) => {
      setCards((prev) => prev.map((c) => c.groupId === groupId ? { ...c, groupId: null } : c))
    })
    socket.on('cards:group-colored', ({ groupId, color }: { groupId: string; color: string }) => {
      setCards((prev) => prev.map((c) => c.groupId === groupId ? { ...c, groupColor: color } : c))
    })

    // Connections
    socket.on('connection:created', (conn) => {
      const cb = pendingConnHistoryRef.current.shift()
      cb?.(conn as Connection)
      setConnections((prev) => (prev.some((c) => c.id === (conn as Connection).id) ? prev : [...prev, conn as Connection]))
    })
    socket.on('connection:deleted', (id) => setConnections((prev) => prev.filter((c) => c.id !== id)))
    socket.on('connection:updated', (conn) => setConnections((prev) => prev.map((c) => c.id === (conn as Connection).id ? { ...c, ...(conn as Connection) } : c)))

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
      socket.io.off('reconnect', handleReconnect)
      socket.emit('board:leave', boardId)
      ;['board:state', 'board:error', 'board:presence', 'board:cursors', 'timer:started', 'timer:stopped',
        'vote:session:started', 'vote:updated', 'vote:session:closed',
        'cards:locked', 'card:layered', 'frame:layered',
        'card:created', 'card:moved', 'card:resized', 'card:updated', 'card:deleted', 'card:recolored',
        'cards:grouped', 'cards:ungrouped', 'cards:group-colored',
        'connection:created', 'connection:deleted', 'connection:updated',
        'frame:created', 'frame:moved', 'frame:resized', 'frame:updated', 'frame:deleted',
        'boardfield:created', 'boardfield:updated', 'boardfield:deleted',
        'cardfield:updated', 'cardfield:cleared',
        'board:imported',
      ].forEach((e) => socket.off(e))
    }
  }, [boardId])

  // ── Cards ─────────────────────────────────────────────────────────────────────
  function addCard(posX: number, posY: number, type?: string, content?: string, color?: string, width?: number, height?: number) {
    const cardColor = color ?? DEFAULT_CARD_COLOR
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

    // Tag local : la carte s'ouvrira en édition uniquement chez son créateur
    // (le redo réutilise emitParams sans tag — pas de ré-édition au redo).
    const clientTag = crypto.randomUUID()
    pendingLocalTagsRef.current.add(clientTag)
    socketRef.current.emit('card:create', { ...emitParams, clientTag })
  }

  // Consommation one-shot par BoardCard à son montage : true une seule fois
  // pour la carte fraîchement créée localement.
  const consumeAutoEdit = useCallback((cardId: string) => {
    if (autoEditCardIdRef.current === cardId) {
      autoEditCardIdRef.current = null
      return true
    }
    return false
  }, [])

  // Flushes the coalesced card:move emits (one socket message per moving card).
  function flushMoveEmits() {
    moveEmitRef.current.raf = null
    const pending = moveEmitRef.current.pending
    if (pending.size === 0) return
    pending.forEach((p, cid) => socketRef.current.emit('card:move', { id: cid, boardId, posX: p.posX, posY: p.posY }))
    pending.clear()
  }
  function scheduleMoveFlush() {
    if (moveEmitRef.current.raf != null) return
    moveEmitRef.current.raf = requestAnimationFrame(flushMoveEmits)
  }

  function moveCard(id: string, posX: number, posY: number) {
    const card = cardsRef.current.find((c) => c.id === id)
    if (!card) return

    const selected = selectedIdsRef.current
    const useSelection = selected.size > 1 && selected.has(id)
    const followIds = new Set<string>()
    if (card.groupId) {
      cardsRef.current.forEach((c) => { if (c.groupId === card.groupId && c.id !== id) followIds.add(c.id) })
    }
    if (useSelection) {
      selected.forEach((sid) => { if (sid !== id) followIds.add(sid) })
    }
    // Locked cards never move, even when dragged as part of a group/selection.
    cardsRef.current.forEach((c) => { if (c.locked) followIds.delete(c.id) })

    // Measure the displacement from the immutable drag-start snapshot rather than
    // the live (and under rapid drags, stale) positions. This pins every follower
    // to the grabbed card with no relative drift. Fall back to an incremental
    // delta only when there's no snapshot (e.g. a programmatic move).
    const starts = cardDragStartRef.current
    const gs = starts?.get(id)
    const dx = gs ? posX - gs.posX : posX - card.posX
    const dy = gs ? posY - gs.posY : posY - card.posY

    const nextPos = new Map<string, { posX: number; posY: number }>()
    nextPos.set(id, { posX, posY })
    followIds.forEach((fid) => {
      const base = starts?.get(fid) ?? cardsRef.current.find((c) => c.id === fid)
      if (base) nextPos.set(fid, { posX: base.posX + dx, posY: base.posY + dy })
    })

    setCards((prev) => prev.map((c) => {
      const p = nextPos.get(c.id)
      return p ? { ...c, posX: p.posX, posY: p.posY } : c
    }))

    nextPos.forEach((p, cid) => moveEmitRef.current.pending.set(cid, p))
    scheduleMoveFlush()
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
    // Locked cards (other than the one grabbed) don't travel with the group.
    cardsRef.current.forEach((c) => { if (c.locked && c.id !== id) movedIds.delete(c.id) })
    cardDragStartRef.current = new Map(
      Array.from(movedIds).flatMap((cid) => {
        const c = cardsRef.current.find((cc) => cc.id === cid)
        return c ? [[cid, { posX: c.posX, posY: c.posY }]] : []
      })
    )
  }

  // Called at drag END — compares start vs end positions and pushes undo entry if moved
  function commitDragCard(_id: string) {
    // Emit the final positions now, in case the last coalesced frame never fired.
    if (moveEmitRef.current.raf != null) { cancelAnimationFrame(moveEmitRef.current.raf); moveEmitRef.current.raf = null }
    flushMoveEmits()

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

  // Resize from any edge/corner: the box may shift (posX/posY) when the top/left side
  // is dragged, so we emit both resize and move.
  function resizeCardBox(id: string, box: { posX: number; posY: number; width: number; height: number }) {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...box } : c))
    socketRef.current.emit('card:resize', { id, boardId, width: box.width, height: box.height })
    socketRef.current.emit('card:move', { id, boardId, posX: box.posX, posY: box.posY })
  }

  function startResizeCard(id: string) {
    const card = cardsRef.current.find((c) => c.id === id)
    if (!card) return
    cardResizeStartRef.current = { id, posX: card.posX, posY: card.posY, width: card.width, height: card.height }
  }

  function commitResizeCard(id: string) {
    const start = cardResizeStartRef.current
    cardResizeStartRef.current = null
    if (!start || start.id !== id) return
    const card = cardsRef.current.find((c) => c.id === id)
    if (!card) return
    const before = { posX: start.posX, posY: start.posY, width: start.width, height: start.height }
    const after = { posX: card.posX, posY: card.posY, width: card.width, height: card.height }
    if (
      Math.abs(after.width - before.width) < 0.5 && Math.abs(after.height - before.height) < 0.5 &&
      Math.abs(after.posX - before.posX) < 0.5 && Math.abs(after.posY - before.posY) < 0.5
    ) return
    const apply = (b: typeof before) => {
      setCards((prev) => prev.map((c) => c.id === id ? { ...c, ...b } : c))
      socketRef.current.emit('card:resize', { id, boardId, width: b.width, height: b.height })
      socketRef.current.emit('card:move', { id, boardId, posX: b.posX, posY: b.posY })
    }
    pushHistory({ undo: () => apply(before), redo: () => apply(after) })
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

  // Selected card ids minus any that are locked — locked cards ignore bulk edits.
  function unlockedSelectedIds() {
    return Array.from(selectedIdsRef.current).filter((id) => !cardsRef.current.find((c) => c.id === id)?.locked)
  }

  function recolorSelected(color: string) {
    const ids = unlockedSelectedIds()
    if (ids.length === 0) return
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
    const ids = unlockedSelectedIds()
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
    const allSameGroup = groupIds.size === 1 && selectedCards.every((c) => c.groupId !== null)

    if (allSameGroup) {
      const existingGroupId = Array.from(groupIds)[0] as string
      let trackedGroupId = existingGroupId
      socketRef.current.emit('cards:ungroup', { boardId, groupId: existingGroupId })
      pushHistory({
        undo: () => {
          socketRef.current.emit('cards:group', { boardId, cardIds: ids })
          pendingGroupHistoryRef.current.push((newGroupId) => { trackedGroupId = newGroupId })
        },
        redo: () => socketRef.current.emit('cards:ungroup', { boardId, groupId: trackedGroupId }),
      })
    } else {
      let trackedGroupId = ''
      pendingGroupHistoryRef.current.push((newGroupId) => {
        trackedGroupId = newGroupId
        pushHistory({
          undo: () => socketRef.current.emit('cards:ungroup', { boardId, groupId: trackedGroupId }),
          redo: () => {
            socketRef.current.emit('cards:group', { boardId, cardIds: ids })
            pendingGroupHistoryRef.current.push((ngId) => { trackedGroupId = ngId })
          },
        })
      })
      socketRef.current.emit('cards:group', { boardId, cardIds: ids })
    }
  }

  // Dissolves a group by id (used by the groups panel).
  function ungroupById(groupId: string) {
    const cardsInGroup = cardsRef.current.filter((c) => c.groupId === groupId)
    if (cardsInGroup.length === 0) { socketRef.current.emit('cards:ungroup', { boardId, groupId }); return }
    const cardIds = cardsInGroup.map((c) => c.id)
    const savedColor = cardsInGroup[0].groupColor ?? null
    let trackedGroupId = groupId
    pushHistory({
      undo: () => {
        socketRef.current.emit('cards:group', { boardId, cardIds })
        pendingGroupHistoryRef.current.push((newGroupId) => {
          trackedGroupId = newGroupId
          if (savedColor) socketRef.current.emit('cards:group-color', { boardId, groupId: newGroupId, color: savedColor })
        })
      },
      redo: () => socketRef.current.emit('cards:ungroup', { boardId, groupId: trackedGroupId }),
    })
    socketRef.current.emit('cards:ungroup', { boardId, groupId })
  }

  // Sets a custom outline color for every card of a group.
  function recolorGroup(groupId: string, color: string) {
    const oldColor = cardsRef.current.find((c) => c.groupId === groupId)?.groupColor ?? null
    if (oldColor === color) return
    setCards((prev) => prev.map((c) => c.groupId === groupId ? { ...c, groupColor: color } : c))
    socketRef.current.emit('cards:group-color', { boardId, groupId, color })
    pushHistory({
      undo: () => {
        setCards((prev) => prev.map((c) => c.groupId === groupId ? { ...c, groupColor: oldColor } : c))
        socketRef.current.emit('cards:group-color', { boardId, groupId, color: oldColor as string })
      },
      redo: () => {
        setCards((prev) => prev.map((c) => c.groupId === groupId ? { ...c, groupColor: color } : c))
        socketRef.current.emit('cards:group-color', { boardId, groupId, color })
      },
    })
  }

  // ── Connections ───────────────────────────────────────────────────────────────
  // Recreates a connection from a saved snapshot, re-applying its style afterwards,
  // and tracks the new server id so further undo/redo stays in sync.
  function recreateConnection(conn: Connection, trackId: (id: string) => void) {
    socketRef.current.emit('connection:create', { boardId, fromId: conn.fromId, toId: conn.toId })
    pendingConnHistoryRef.current.push((created: Connection) => {
      trackId(created.id)
      const patch = { label: conn.label, color: conn.color, shape: conn.shape, arrow: conn.arrow, dashed: conn.dashed, width: conn.width }
      socketRef.current.emit('connection:update', { id: created.id, boardId, ...patch })
    })
  }

  function addConnection(fromId: string, toId: string) {
    socketRef.current.emit('connection:create', { boardId, fromId, toId })
    pendingConnHistoryRef.current.push((created: Connection) => {
      let trackedId = created.id
      pushHistory({
        undo: () => socketRef.current.emit('connection:delete', { id: trackedId, boardId }),
        redo: () => {
          socketRef.current.emit('connection:create', { boardId, fromId, toId })
          pendingConnHistoryRef.current.push((again: Connection) => { trackedId = again.id })
        },
      })
    })
  }

  function deleteConnection(id: string) {
    const conn = connectionsRef.current.find((c) => c.id === id)
    if (!conn) return
    let trackedId = id
    pushHistory({
      undo: () => recreateConnection(conn, (newId) => { trackedId = newId }),
      redo: () => socketRef.current.emit('connection:delete', { id: trackedId, boardId }),
    })
    socketRef.current.emit('connection:delete', { id, boardId })
  }

  function updateConnection(id: string, patch: ConnectionPatch) {
    const conn = connectionsRef.current.find((c) => c.id === id)
    if (!conn) return
    const before: ConnectionPatch = {}
    ;(Object.keys(patch) as (keyof ConnectionPatch)[]).forEach((k) => { (before as Record<string, unknown>)[k] = conn[k] })
    setConnections((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))
    socketRef.current.emit('connection:update', { id, boardId, ...patch })
    pushHistory({
      undo: () => {
        setConnections((prev) => prev.map((c) => c.id === id ? { ...c, ...before } : c))
        socketRef.current.emit('connection:update', { id, boardId, ...before })
      },
      redo: () => {
        setConnections((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))
        socketRef.current.emit('connection:update', { id, boardId, ...patch })
      },
    })
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

  // Directional resize: width/height plus posX/posY (for n/w/nw/ne/sw drags).
  function resizeFrameBox(id: string, posX: number, posY: number, width: number, height: number) {
    setFrames((prev) => prev.map((f) => f.id === id ? { ...f, posX, posY, width, height } : f))
    socketRef.current.emit('frame:move', { id, boardId, posX, posY })
    socketRef.current.emit('frame:resize', { id, boardId, width, height })
  }

  function startResizeFrame(id: string) {
    const frame = framesRef.current.find((f) => f.id === id)
    if (!frame) return
    frameResizeStartRef.current = { id, posX: frame.posX, posY: frame.posY, width: frame.width, height: frame.height }
  }

  function commitResizeFrame(id: string) {
    const start = frameResizeStartRef.current
    frameResizeStartRef.current = null
    if (!start || start.id !== id) return
    const frame = framesRef.current.find((f) => f.id === id)
    if (!frame) return
    const old = { posX: start.posX, posY: start.posY, width: start.width, height: start.height }
    const next = { posX: frame.posX, posY: frame.posY, width: frame.width, height: frame.height }
    if (
      Math.abs(next.width - old.width) < 0.5 && Math.abs(next.height - old.height) < 0.5 &&
      Math.abs(next.posX - old.posX) < 0.5 && Math.abs(next.posY - old.posY) < 0.5
    ) return
    const apply = (b: typeof old) => {
      setFrames((prev) => prev.map((f) => f.id === id ? { ...f, ...b } : f))
      socketRef.current.emit('frame:move', { id, boardId, posX: b.posX, posY: b.posY })
      socketRef.current.emit('frame:resize', { id, boardId, width: b.width, height: b.height })
    }
    pushHistory({ undo: () => apply(old), redo: () => apply(next) })
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

  function setFrameActive(id: string, active: boolean) {
    const old = framesRef.current.find((f) => f.id === id)?.active ?? false
    if (old === active) return
    setFrames((prev) => prev.map((f) => f.id === id ? { ...f, active } : f))
    socketRef.current.emit('frame:update', { id, boardId, active })
    pushHistory({
      undo: () => {
        setFrames((prev) => prev.map((f) => f.id === id ? { ...f, active: old } : f))
        socketRef.current.emit('frame:update', { id, boardId, active: old })
      },
      redo: () => {
        setFrames((prev) => prev.map((f) => f.id === id ? { ...f, active } : f))
        socketRef.current.emit('frame:update', { id, boardId, active })
      },
    })
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

  function startTimer(duration: number) {
    socketRef.current.emit('timer:start', { boardId, duration })
  }

  function stopTimer() {
    socketRef.current.emit('timer:stop', { boardId })
  }

  // ── Vote ──────────────────────────────────────────────────────────────────────
  function startVote(config: { votesPerPerson: number; timerSeconds: number | null; voterIds: string[] }) {
    socketRef.current.emit('vote:start', { boardId, ...config })
  }

  function castVote(cardId: string) {
    if (!activeVoteSession) return
    socketRef.current.emit('vote:cast', { sessionId: activeVoteSession.id, boardId, cardId })
  }

  function uncastVote(cardId: string) {
    if (!activeVoteSession) return
    socketRef.current.emit('vote:uncast', { sessionId: activeVoteSession.id, boardId, cardId })
  }

  function stopVote() {
    if (!activeVoteSession) return
    socketRef.current.emit('vote:stop', { sessionId: activeVoteSession.id, boardId })
  }

  function extendVote(extraSeconds: number) {
    if (!activeVoteSession) return
    socketRef.current.emit('vote:extend', { sessionId: activeVoteSession.id, boardId, extraSeconds })
  }

  // ── Board info update (description, cover, max participants, activities) ─────
  async function updateBoardInfo(input: {
    name?: string
    description?: string | null
    coverImage?: string | null
    maxParticipants?: number | null
    enabledActivities?: string[] | null
  }) {
    const updated = await api.patch<BoardDetail>(`/api/boards/${boardId}`, input)
    setBoard((prev) => (prev ? { ...prev, ...updated } : prev))
    return updated
  }

  // ── Layers ───────────────────────────────────────────────────────────────────
  function setCardLayer(id: string, layer: number) {
    const oldLayer = cardsRef.current.find((c) => c.id === id)?.layer ?? 1
    if (oldLayer === layer) return
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, layer } : c))
    socketRef.current.emit('card:layer', { id, boardId, layer })
    pushHistory({
      undo: () => {
        setCards((prev) => prev.map((c) => c.id === id ? { ...c, layer: oldLayer } : c))
        socketRef.current.emit('card:layer', { id, boardId, layer: oldLayer })
      },
      redo: () => {
        setCards((prev) => prev.map((c) => c.id === id ? { ...c, layer } : c))
        socketRef.current.emit('card:layer', { id, boardId, layer })
      },
    })
  }

  function setFrameLayer(id: string, layer: number) {
    const oldLayer = framesRef.current.find((f) => f.id === id)?.layer ?? 1
    if (oldLayer === layer) return
    setFrames((prev) => prev.map((f) => f.id === id ? { ...f, layer } : f))
    socketRef.current.emit('frame:layer', { id, boardId, layer })
    pushHistory({
      undo: () => {
        setFrames((prev) => prev.map((f) => f.id === id ? { ...f, layer: oldLayer } : f))
        socketRef.current.emit('frame:layer', { id, boardId, layer: oldLayer })
      },
      redo: () => {
        setFrames((prev) => prev.map((f) => f.id === id ? { ...f, layer } : f))
        socketRef.current.emit('frame:layer', { id, boardId, layer })
      },
    })
  }

  // Applies a layer to all selected cards in one batched undo entry.
  function setLayerSelected(layer: number) {
    const ids = Array.from(selectedIdsRef.current)
    if (ids.length === 0) return
    const oldLayers = new Map(ids.map((id) => {
      const c = cardsRef.current.find((cc) => cc.id === id)
      return [id, c?.layer ?? 1] as [string, number]
    }))
    if ([...oldLayers.values()].every((l) => l === layer)) return
    setCards((prev) => prev.map((c) => ids.includes(c.id) ? { ...c, layer } : c))
    ids.forEach((id) => socketRef.current.emit('card:layer', { id, boardId, layer }))
    pushHistory({
      undo: () => {
        setCards((prev) => prev.map((c) => ids.includes(c.id) ? { ...c, layer: oldLayers.get(c.id) ?? 1 } : c))
        ids.forEach((id) => socketRef.current.emit('card:layer', { id, boardId, layer: oldLayers.get(id) ?? 1 }))
      },
      redo: () => {
        setCards((prev) => prev.map((c) => ids.includes(c.id) ? { ...c, layer } : c))
        ids.forEach((id) => socketRef.current.emit('card:layer', { id, boardId, layer }))
      },
    })
  }

  // ── Lock ──────────────────────────────────────────────────────────────────────
  function lockCards(ids: string[], locked: boolean) {
    const prevLocked = new Map(ids.map((id) => {
      const c = cardsRef.current.find((cc) => cc.id === id)
      return [id, c?.locked ?? false] as [string, boolean]
    }))
    socketRef.current.emit('card:lock', { ids, boardId, locked })
    pushHistory({
      undo: () => {
        const toLock = ids.filter((id) => prevLocked.get(id) === true)
        const toUnlock = ids.filter((id) => prevLocked.get(id) === false)
        if (toLock.length) socketRef.current.emit('card:lock', { ids: toLock, boardId, locked: true })
        if (toUnlock.length) socketRef.current.emit('card:lock', { ids: toUnlock, boardId, locked: false })
      },
      redo: () => socketRef.current.emit('card:lock', { ids, boardId, locked }),
    })
  }

  function lockSelected(locked: boolean) {
    // Drawings can't be locked.
    const ids = Array.from(selectedIdsRef.current).filter((id) => cardsRef.current.find((c) => c.id === id)?.type !== 'DRAW')
    if (ids.length === 0) return
    lockCards(ids, locked)
  }

  // ── Batch positioning (nudge / arrange) ────────────────────────────────────
  // Applies absolute positions to several cards at once, emits the moves, and
  // records a single combined undo entry.
  function setCardPositions(targets: { id: string; posX: number; posY: number }[]) {
    if (targets.length === 0) return
    const before = new Map<string, { posX: number; posY: number }>()
    targets.forEach((t) => {
      const c = cardsRef.current.find((cc) => cc.id === t.id)
      if (c) before.set(t.id, { posX: c.posX, posY: c.posY })
    })
    const after = new Map(targets.map((t) => [t.id, { posX: t.posX, posY: t.posY }]))

    const apply = (m: Map<string, { posX: number; posY: number }>) => {
      setCards((prev) => prev.map((c) => (m.has(c.id) ? { ...c, ...m.get(c.id)! } : c)))
      m.forEach((p, id) => socketRef.current.emit('card:move', { id, boardId, posX: p.posX, posY: p.posY }))
    }
    apply(after)

    let changed = false
    before.forEach((b, id) => {
      const a = after.get(id)!
      if (Math.abs(a.posX - b.posX) > 0.5 || Math.abs(a.posY - b.posY) > 0.5) changed = true
    })
    if (!changed) return
    pushHistory({ undo: () => apply(before), redo: () => apply(after) })
  }

  // Nudge every selected (unlocked) card by a delta — used by arrow-key moves.
  function moveSelectedBy(dx: number, dy: number) {
    const ids = Array.from(selectedIdsRef.current)
    const targets = ids.flatMap((id) => {
      const c = cardsRef.current.find((cc) => cc.id === id)
      return c && !c.locked ? [{ id, posX: c.posX + dx, posY: c.posY + dy }] : []
    })
    setCardPositions(targets)
  }

  // Re-lay the selected cards as a row, column, or grid, anchored at their
  // current top-left, ordered by reading order for a stable result.
  function arrangeSelected(layout: 'row' | 'column' | 'grid') {
    const sel = unlockedSelectedIds().flatMap((id) => {
      const c = cardsRef.current.find((cc) => cc.id === id)
      return c ? [c] : []
    })
    if (sel.length < 2) return
    const GAP = 24
    const minX = Math.min(...sel.map((c) => c.posX))
    const minY = Math.min(...sel.map((c) => c.posY))
    const ordered = [...sel].sort((a, b) => a.posY - b.posY || a.posX - b.posX)
    const targets: { id: string; posX: number; posY: number }[] = []

    if (layout === 'row') {
      let x = minX
      for (const c of ordered) { targets.push({ id: c.id, posX: x, posY: minY }); x += c.width + GAP }
    } else if (layout === 'column') {
      let y = minY
      for (const c of ordered) { targets.push({ id: c.id, posX: minX, posY: y }); y += c.height + GAP }
    } else {
      const cols = Math.ceil(Math.sqrt(ordered.length))
      const colW = Math.max(...sel.map((c) => c.width)) + GAP
      const rowH = Math.max(...sel.map((c) => c.height)) + GAP
      ordered.forEach((c, i) => {
        targets.push({ id: c.id, posX: minX + (i % cols) * colW, posY: minY + Math.floor(i / cols) * rowH })
      })
    }
    setCardPositions(targets)
  }

  function pasteCards(clipCards: ClipboardCard[], canvasX: number, canvasY: number) {
    if (clipCards.length === 0) return

    const minX = Math.min(...clipCards.map((c) => c.posX))
    const minY = Math.min(...clipCards.map((c) => c.posY))
    const maxX = Math.max(...clipCards.map((c) => c.posX + c.width))
    const maxY = Math.max(...clipCards.map((c) => c.posY + c.height))
    const dx = canvasX - (minX + maxX) / 2
    const dy = canvasY - (minY + maxY) / 2

    // original groupId → indices in clipCards (only groups with 2+ cards)
    const groupMap = new Map<string, number[]>()
    clipCards.forEach((c, i) => {
      if (c.groupId) {
        const arr = groupMap.get(c.groupId) ?? []
        arr.push(i)
        groupMap.set(c.groupId, arr)
      }
    })
    const groupsToDo = [...groupMap.entries()].filter(([, idxs]) => idxs.length >= 2)

    // Mutated by redo so undo always targets the latest IDs
    let currentIds: string[] = []

    function spawnCards(onAllCreated: (ids: string[]) => void) {
      const ids = new Array<string>(clipCards.length).fill('')
      let remaining = clipCards.length
      clipCards.forEach((c, i) => {
        pendingCardHistoryRef.current.push((card: Card) => {
          ids[i] = card.id
          remaining--
          if (remaining === 0) onAllCreated(ids)
        })
        socketRef.current.emit('card:create', {
          boardId, posX: c.posX + dx, posY: c.posY + dy,
          type: c.type, content: c.content, color: c.color,
          width: c.width, height: c.height, layer: c.layer ?? 1,
        })
      })
    }

    function regroup(newIds: string[]) {
      groupsToDo.forEach(([, idxs]) => {
        const cardIds = idxs.map((idx) => newIds[idx]).filter(Boolean) as string[]
        if (cardIds.length < 2) return
        const groupCol = clipCards[idxs[0]].groupColor
        // Push callback 1:1 with cards:group emit to capture the new groupId
        pendingGroupHistoryRef.current.push((newGroupId) => {
          if (groupCol) socketRef.current.emit('cards:group-color', { boardId, groupId: newGroupId, color: groupCol })
        })
        socketRef.current.emit('cards:group', { boardId, cardIds })
      })
    }

    spawnCards((ids) => {
      currentIds = ids
      regroup(ids)
      pushHistory({
        undo: () => currentIds.forEach((id) => socketRef.current.emit('card:delete', { id, boardId })),
        redo: () => spawnCards((redoIds) => { currentIds = redoIds; regroup(redoIds) }),
      })
    })
  }

  const isReadonly = userRole === 'VIEWER'

  const cursorThrottleRef = useRef(0)
  function emitCursor(boardId: string, x: number, y: number) {
    const now = Date.now()
    if (now - cursorThrottleRef.current < 50) return
    cursorThrottleRef.current = now
    socketRef.current.emit('board:cursor', { boardId, x, y })
  }

  return {
    board, cards, connections, frames, fields, selectedIds, isLoading, userRole, isReadonly, accessDenied, presence, members, cursors,
    timerEndsAt, startTimer, stopTimer,
    activeVoteSession, lastVoteSession, startVote, castVote, uncastVote, stopVote, extendVote,
    lockCards, lockSelected,
    setCardLayer, setFrameLayer, setLayerSelected,
    moveSelectedBy, arrangeSelected,
    updateBoardInfo,
    addCard, consumeAutoEdit, moveCard, resizeCard, resizeCardBox, updateCard, deleteCard, deleteSelected, recolorCard, recolorSelected,
    startDragCard, commitDragCard, startResizeCard, commitResizeCard,
    groupSelected, ungroupById, recolorGroup,
    addConnection, deleteConnection, updateConnection,
    addFrame, moveFrame, resizeFrameBox, updateFrame, setFrameActive, deleteFrame,
    startDragFrame, commitDragFrame, startResizeFrame, commitResizeFrame,
    createField, updateField, deleteField,
    setFieldValue, clearFieldValue,
    selectCards,
    pasteCards,
    undo, redo, canUndo, canRedo,
    resetBoard,
    importCount,
    emitCursor,
  }
}
