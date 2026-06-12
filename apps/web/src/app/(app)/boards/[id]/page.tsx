'use client'

import { use, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { MAX_FRAMES_PER_BOARD } from '@pouetpouet/shared'
import { useBoard } from '@/hooks/useBoard'
import type { Card, ClipboardCard } from '@/hooks/useBoard'
import { useSession } from '@/hooks/useSession'
import { BoardCanvas } from '@/components/board/board-canvas'
import type { BoardCanvasHandle } from '@/components/board/board-canvas'
import { BoardFieldsPanel } from '@/components/board/board-fields-panel'
import { ShareModal } from '@/components/board/share-modal'
import { ImportHubModal } from '@/components/board/import-hub-modal'
import { ImportKlaxoonModal } from '@/components/board/import-klaxoon-modal'
import { ImportPdfModal, type PdfPageData } from '@/components/board/import-pdf-modal'
import { ExportHubModal, type ExportFormat } from '@/components/board/export-hub-modal'
import { exportBoardExcel } from '@/lib/export-excel'
import { exportBoardPpb } from '@/lib/export-ppb'
import { BoardSettingsModal } from '@/components/board/board-settings-modal'
import { useTemplates } from '@/hooks/useTemplates'
import { useRouter } from 'next/navigation'
import { HostPanel } from '@/components/session/host-panel'
import { FloatingToolbar } from '@/components/board/floating-toolbar'
import type { ToolMode, StrokeSize } from '@/components/board/floating-toolbar'
import { TimerOverlay } from '@/components/board/timer-overlay'
import { VoteConfigModal } from '@/components/board/vote-config-modal'
import { VoteResultsPanel } from '@/components/board/vote-results-panel'
import { VoteEndOverlay } from '@/components/board/vote-end-overlay'
import { PresenceIndicator } from '@/components/board/presence-indicator'
import { TemplateDraftBanner } from '@/components/board/template-draft-banner'
import { useAuthStore } from '@/store/auth'
import { ColorPopover } from '@/components/ui/color-picker'
import { GroupsPanel } from '@/components/board/groups-panel'
import { useBoardSession } from '@/hooks/useBoardSession'

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
    board, cards, connections, frames, fields, selectedIds, isLoading, userRole, isReadonly, accessDenied, presence, members, cursors,
    timerEndsAt, startTimer, stopTimer,
    activeVoteSession, lastVoteSession, startVote, castVote, uncastVote, stopVote, extendVote,
    lockCards, lockSelected,
    setCardLayer, setFrameLayer, setLayerSelected,
    moveSelectedBy, arrangeSelected,
    updateBoardInfo,
    addCard, consumeAutoEdit, remoteEditors, notifyEditing, moveCard, resizeCard, resizeCardBox, updateCard, deleteCard, deleteSelected, recolorCard, recolorSelected,
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
  } = useBoard(id)
  const {
    session, participantCount, currentActivity, activityResponses, lastReport, clearLastReport, isLoading: sessionLoading,
    startSession, closeSession, launchActivity, closeActivity,
  } = useSession(id)

  const currentUser = useAuthStore((s) => s.user)
  const currentUserId = currentUser?.id ?? ''

  const boardSession = useBoardSession(id, currentUserId || undefined, userRole === 'OWNER')

  const router = useRouter()
  const { saveTemplateFromDraft, discardTemplateDraft } = useTemplates()
  const [savingDraft, setSavingDraft] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  function startEditingName() {
    if (userRole !== 'OWNER' || !board) return
    setNameDraft(board.name)
    setEditingName(true)
  }
  async function commitName() {
    if (!board) return
    const next = nameDraft.trim()
    setEditingName(false)
    if (!next || next === board.name) return
    try {
      await updateBoardInfo({ name: next })
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const templateDraftOf = board?.templateDraftOf ?? null
  async function handleSaveDraft() {
    if (!templateDraftOf) return
    setSavingDraft(true)
    try {
      await saveTemplateFromDraft(templateDraftOf)
      router.push('/dashboard')
    } catch (err) {
      alert((err as Error).message)
      setSavingDraft(false)
    }
  }
  async function handleDiscardDraft() {
    if (!templateDraftOf) return
    if (!confirm('Annuler les modifications du template ?')) return
    setSavingDraft(true)
    try {
      await discardTemplateDraft(templateDraftOf)
      router.push('/dashboard')
    } catch (err) {
      alert((err as Error).message)
      setSavingDraft(false)
    }
  }

  const [clipboard, setClipboard] = useState<ClipboardCard[]>([])
  useEffect(() => {
    try {
      const stored = localStorage.getItem('klx_clipboard')
      if (stored) setClipboard(JSON.parse(stored) as ClipboardCard[])
    } catch {}
  }, [])

  const [showFieldsPanel, setShowFieldsPanel] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showImportHub, setShowImportHub] = useState(false)
  const [showImportKlaxoon, setShowImportKlaxoon] = useState(false)
  const [showImportPdf, setShowImportPdf] = useState(false)
  const [showExportHub, setShowExportHub] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const imageImportRef = useRef<HTMLInputElement>(null)
  const [showGroupsPanel, setShowGroupsPanel] = useState(false)
  const [highlightedGroupId, setHighlightedGroupId] = useState<string | null>(null)
  const groupsBtnRef = useRef<HTMLButtonElement>(null)
  const [groupsBtnRect, setGroupsBtnRect] = useState<DOMRect | null>(null)
  const groupsLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleGroupsEnter() {
    if (groupsLeaveTimer.current) clearTimeout(groupsLeaveTimer.current)
    if (groupsBtnRef.current) setGroupsBtnRect(groupsBtnRef.current.getBoundingClientRect())
    setShowGroupsPanel(true)
  }
  function handleGroupsLeave() {
    // Stay open if a group is highlighted (panel is "pinned").
    if (highlightedGroupId) return
    groupsLeaveTimer.current = setTimeout(() => setShowGroupsPanel(false), 150)
  }
  const [showVoteConfig, setShowVoteConfig] = useState(false)
  const [showVoteResults, setShowVoteResults] = useState(false)
  const [showLastVote, setShowLastVote] = useState(false)
  const [showVoteEnd, setShowVoteEnd] = useState(false)
  const [showVoteMenu, setShowVoteMenu] = useState(false)
  const voteMenuContainerRef = useRef<HTMLDivElement>(null)
  const [voteMenuRect, setVoteMenuRect] = useState<DOMRect | null>(null)
  const [showOverflowMenu, setShowOverflowMenu] = useState(false)
  const overflowMenuContainerRef = useRef<HTMLDivElement>(null)
  const [showTimerPicker, setShowTimerPicker] = useState(false)
  const [timerCustomMin, setTimerCustomMin] = useState('5')
  const [timerCustomSec, setTimerCustomSec] = useState('00')
  const [now, setNow] = useState(() => Date.now())
  const canvasApiRef = useRef<BoardCanvasHandle>(null)
  const [exporting, setExporting] = useState(false)

  async function handleExport(format: ExportFormat) {
    if (exporting) return
    setExporting(true)
    try {
      if (format === 'pdf') {
        await canvasApiRef.current?.exportPdf()
      } else if (format === 'image') {
        await canvasApiRef.current?.exportImage()
      } else if (format === 'excel') {
        await exportBoardExcel(board?.name ?? 'board', cards, connections, frames)
      } else if (format === 'ppb') {
        await exportBoardPpb(board?.name ?? 'board', cards, connections, frames, fields)
      }
    } finally {
      setExporting(false)
    }
  }

  async function handleImageImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    e.target.value = ''
    let offsetX = 100
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      const img = new Image()
      await new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.src = dataUrl
      })
      const MAX_W = 700, MAX_H = 600
      const ratio = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1)
      const w = Math.max(80, Math.round(img.naturalWidth * ratio))
      const h = Math.max(60, Math.round(img.naturalHeight * ratio))
      addCard(offsetX, 100, 'IMAGE', dataUrl, 'transparent', w, h)
      offsetX += w + 24
    }
    setTimeout(() => canvasApiRef.current?.fitToContent(), 100)
  }

  function handlePdfImport(pages: PdfPageData[]) {
    setShowImportPdf(false)
    let x = 100
    for (const page of pages) {
      addCard(x, 100, 'IMAGE', page.dataUrl, 'transparent', page.width, page.height)
      x += page.width + 24
    }
    setTimeout(() => canvasApiRef.current?.fitToContent(), 100)
  }
  const timerPickerRef = useRef<HTMLDivElement>(null)
  const [timerPickerRect, setTimerPickerRect] = useState<DOMRect | null>(null)

  function launchCustomTimer() {
    const min = Math.max(0, parseInt(timerCustomMin, 10) || 0)
    const sec = Math.max(0, Math.min(59, parseInt(timerCustomSec, 10) || 0))
    const total = min * 60 + sec
    if (total <= 0) return
    startTimer(total)
    setShowTimerPicker(false)
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  // Fermeture LOCALE de l'overlay de fin : chacun ferme chez soi (avant, le
  // bouton émettait timer:stopped et fermait l'overlay de tout le monde).
  const [timerDismissed, setTimerDismissed] = useState(false)
  const timerSecondsLeft = timerEndsAt !== null && !timerDismissed ? Math.max(0, Math.ceil((timerEndsAt - now) / 1000)) : null
  const timerExpired = timerEndsAt !== null && !timerDismissed && now >= timerEndsAt

  // Un nouveau timer (ou un stop) réarme l'affichage local
  const lastTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (timerEndsAt !== lastTimerRef.current) {
      lastTimerRef.current = timerEndsAt
      setTimerDismissed(false)
    }
  }, [timerEndsAt])

  const voteTimerEndsAt = activeVoteSession?.timerEndsAt ? new Date(activeVoteSession.timerEndsAt).getTime() : null
  const voteTimerSecondsLeft = voteTimerEndsAt !== null ? Math.max(0, Math.ceil((voteTimerEndsAt - now) / 1000)) : null
  const voteTimerExpired = voteTimerEndsAt !== null && now >= voteTimerEndsAt

  useEffect(() => {
    if (importCount > 0) canvasApiRef.current?.fitToContent()
  }, [importCount])

  const voteTimerWasExpiredRef = useRef(false)
  useEffect(() => {
    if (voteTimerExpired && !voteTimerWasExpiredRef.current && activeVoteSession) {
      voteTimerWasExpiredRef.current = true
      setShowVoteEnd(true)
    }
    if (!voteTimerExpired) {
      voteTimerWasExpiredRef.current = false
    }
  }, [voteTimerExpired, activeVoteSession])

  // Clôture du vote (par l'hôte ou le timer) → les résultats s'ouvrent chez
  // TOUS les participants de la session, pas seulement chez celui qui clôt.
  const watchedVoteIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeVoteSession) {
      watchedVoteIdRef.current = activeVoteSession.id
    } else if (watchedVoteIdRef.current && lastVoteSession?.id === watchedVoteIdRef.current) {
      watchedVoteIdRef.current = null
      setShowVoteEnd(false)
      setShowLastVote(true)
    }
  }, [activeVoteSession, lastVoteSession])

  useEffect(() => {
    if (!showVoteMenu) return
    function handleClick(e: MouseEvent) {
      if (voteMenuContainerRef.current && !voteMenuContainerRef.current.contains(e.target as Node)) {
        setShowVoteMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showVoteMenu])

  useEffect(() => {
    if (!showOverflowMenu) return
    function handleClick(e: MouseEvent) {
      if (overflowMenuContainerRef.current && !overflowMenuContainerRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showOverflowMenu])

  useEffect(() => {
    if (!showTimerPicker) return
    function handleClick(e: MouseEvent) {
      if (timerPickerRef.current && !timerPickerRef.current.contains(e.target as Node)) {
        setShowTimerPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showTimerPicker])
  const [confirmReset, setConfirmReset] = useState(false)
  const confirmResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleResetClick() {
    if (!confirmReset) {
      setConfirmReset(true)
      confirmResetTimer.current = setTimeout(() => setConfirmReset(false), 3000)
    } else {
      if (confirmResetTimer.current) clearTimeout(confirmResetTimer.current)
      setConfirmReset(false)
      resetBoard()
    }
  }
  const [toolMode, setToolMode] = useState<ToolMode>('select')
  const [toolColor, setToolColor] = useState('#6366f1')
  const [toolStroke, setToolStroke] = useState<StrokeSize>('medium')
  const [toolFill, setToolFill] = useState(false)
  const [toolOpacity, setToolOpacity] = useState(0.3)

  function handleToolChange(tool: ToolMode, color?: string, stroke?: StrokeSize, fill?: boolean, opacity?: number) {
    if (tool !== toolMode) selectCards(new Set())
    setToolMode(tool)
    if (color !== undefined) setToolColor(color)
    if (stroke !== undefined) setToolStroke(stroke)
    if (fill !== undefined) setToolFill(fill)
    if (opacity !== undefined) setToolOpacity(opacity)
  }

  function closeAllDropdowns() {
    setShowVoteMenu(false)
    setShowOverflowMenu(false)
    setShowTimerPicker(false)
  }
  function closeAllOverlays() {
    setShowVoteMenu(false)
    setShowOverflowMenu(false)
    setShowTimerPicker(false)
    setShowGroupsPanel(false)
    setHighlightedGroupId(null)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isReadonly) return
      // Ctrl+Z / Ctrl+Y: undo / redo (before focus check so they work even in inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }
      // Ctrl+C: copy regardless of what is focused
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const sel = cards.filter((c) => selectedIds.has(c.id))
        if (sel.length === 0) return
        const data: ClipboardCard[] = sel.map(({ type, content, color, posX, posY, width, height, layer, groupId, groupColor }) => ({
          type, content, color, posX, posY, width, height, layer: layer ?? 1, groupId, groupColor,
        }))
        setClipboard(data)
        try { localStorage.setItem('klx_clipboard', JSON.stringify(data)) } catch {}
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return
      // Ctrl+A: select every card on the board
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectCards(new Set(cards.map((c) => c.id)))
        return
      }
      // Ctrl+D: duplicate the selection in place (slightly offset)
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        if (selectedIds.size > 0) duplicateSelection()
        return
      }
      // Arrow keys: nudge the selection (1px, or 20px with Shift)
      if (selectedIds.size > 0 && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const step = e.shiftKey ? 20 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        moveSelectedBy(dx, dy)
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) deleteSelected()
      }
      if (e.key === 'Escape') {
        setToolMode('select')
        selectCards(new Set())
        setShowVoteMenu(false)
        setShowOverflowMenu(false)
        setShowTimerPicker(false)
        setShowGroupsPanel(false)
        setHighlightedGroupId(null)
      }
      if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) setToolMode('select')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadonly, selectedIds, deleteSelected, selectCards, cards, undo, redo, moveSelectedBy])

  // Duplicate the current selection, offset by 24px so the copies are visible.
  function duplicateSelection() {
    const sel = cards.filter((c) => selectedIds.has(c.id))
    if (sel.length === 0) return
    sel.forEach(({ type, content, color, posX, posY, width, height }) => {
      addCard(posX + 24, posY + 24, type, content, color, width, height)
    })
  }


  const selectedCards = cards.filter((c) => selectedIds.has(c.id))
  const selectedGroupIds = new Set(selectedCards.map((c) => c.groupId).filter(Boolean))
  const allInSameGroup = selectedGroupIds.size === 1 && selectedCards.every((c) => c.groupId !== null)
  const canGroup = selectedIds.size >= 2
  const groupCount = new Set(cards.map((c) => c.groupId).filter(Boolean)).size

  const myVoteCount = activeVoteSession?.votes.filter((v) => v.userId === currentUserId).length ?? 0
  const voteRemaining = activeVoteSession ? activeVoteSession.votesPerPerson - myVoteCount : 0
  const isEligibleVoter = activeVoteSession?.voterIds.includes(currentUserId) ?? false
  const voteCanVote = voteTimerEndsAt === null || !voteTimerExpired

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V7m0 0a5 5 0 00-5 5h10a5 5 0 00-5-5z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Accès refusé</h2>
        <p className="text-sm text-gray-500">Tu n'as pas accès à ce board. Demande au propriétaire de te partager le lien.</p>
        <Link href="/dashboard" className="text-sm text-primary-600 hover:text-primary-700 font-medium">← Retour au dashboard</Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Template draft banner */}
      {templateDraftOf && (
        <TemplateDraftBanner saving={savingDraft} onSave={handleSaveDraft} onDiscard={handleDiscardDraft} />
      )}

      {/* Toolbar */}
      <div data-popover-anchor className="flex items-center gap-2 px-4 h-14 bg-white border-b border-gray-200 shrink-0 overflow-x-auto">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors mr-1 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        {editingName && userRole === 'OWNER' ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur() }
              else if (e.key === 'Escape') { setEditingName(false) }
            }}
            className="font-semibold text-gray-900 flex-1 max-w-md truncate min-w-0 bg-white border border-primary-300 rounded-lg px-2 py-1 -my-1 outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
          />
        ) : (
          <h1
            onClick={startEditingName}
            title={userRole === 'OWNER' ? 'Cliquer pour renommer' : undefined}
            className={`font-semibold text-gray-900 flex-1 max-w-md truncate min-w-0 px-2 py-1 -my-1 rounded-lg ${userRole === 'OWNER' ? 'cursor-text hover:bg-gray-100' : ''}`}
          >
            {board?.name}
          </h1>
        )}

        {/* Spacer so the rest of the toolbar items hug the right edge */}
        <div className="flex-1" />

        {/* Presence indicator */}
        <PresenceIndicator presence={presence} members={members} dropdownTop={templateDraftOf ? 170 : 120} />

        {/* Role badge (non-owner) */}
        {userRole && userRole !== 'OWNER' && (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${isReadonly ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
            {isReadonly ? 'Lecture seule' : 'Éditeur'}
          </span>
        )}
        {/* Session active badge for non-owner board members */}
        {userRole !== 'OWNER' && boardSession.activeSession && (
          <div className="flex items-center gap-1.5 rounded-full bg-primary-50 border border-primary-200 px-3 py-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
            <span className="text-xs font-semibold text-primary-600 font-mono tracking-widest">{boardSession.activeSession.code}</span>
          </div>
        )}

        {/* ── Group: share + settings (owner) ─────────────────────────────── */}
        {userRole === 'OWNER' && (
          <>
            <div className="w-px h-6 bg-gray-200 shrink-0" aria-hidden />
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={() => { closeAllOverlays(); setShowImportHub(true) }}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                title="Importer…"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
              <button
                onClick={() => { closeAllOverlays(); setShowExportHub(true) }}
                disabled={exporting}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-wait"
                title="Exporter…"
              >
                {exporting ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 7H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
              </button>
              <button
                onClick={() => { closeAllOverlays(); setShowShareModal(true) }}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                title="Partager le board"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
              <button
                onClick={() => { closeAllOverlays(); setShowSettingsModal(true) }}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                title="Paramètres du board"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </>
        )}

        {/* ── Group: history (undo/redo/reset) ────────────────────────────── */}
        {!isReadonly && (
          <>
            <div className="w-px h-6 bg-gray-200 shrink-0" aria-hidden />
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={undo}
                disabled={!canUndo}
                title="Annuler (Ctrl+Z)"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6-6M3 10l6 6" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                title="Rétablir (Ctrl+Y)"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2M21 10l-6-6M21 10l-6 6" />
                </svg>
              </button>
              {userRole === 'OWNER' && (
              <button
                onClick={handleResetClick}
                title={confirmReset ? 'Cliquer pour confirmer la réinitialisation' : 'Réinitialiser le board'}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                  confirmReset
                    ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              )}
            </div>
          </>
        )}

        {/* ── Group: activities (vote / last vote / timer) ────────────────── */}
        <div className="w-px h-6 bg-gray-200 shrink-0" aria-hidden />
        <div className="flex items-center gap-0.5 shrink-0">

        {/* Vote */}
        {activeVoteSession ? (
          <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 shrink-0 ${voteTimerSecondsLeft !== null && voteTimerSecondsLeft <= 10 ? 'bg-red-50 border-red-200' : voteTimerSecondsLeft !== null && voteTimerSecondsLeft <= 30 ? 'bg-orange-50 border-orange-200' : 'bg-secondary-50 border-secondary-200'}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse shrink-0 ${voteTimerSecondsLeft !== null && voteTimerSecondsLeft <= 10 ? 'bg-red-400' : voteTimerSecondsLeft !== null && voteTimerSecondsLeft <= 30 ? 'bg-orange-400' : 'bg-secondary-400'}`} />
            <span className={`text-xs font-semibold ${voteTimerSecondsLeft !== null && voteTimerSecondsLeft <= 10 ? 'text-red-700' : voteTimerSecondsLeft !== null && voteTimerSecondsLeft <= 30 ? 'text-orange-700' : 'text-secondary-700'}`}>Vote en cours</span>
            {voteTimerSecondsLeft !== null && (
              <span className={`text-xs font-mono font-bold tabular-nums ${voteTimerSecondsLeft <= 10 ? 'text-red-600' : voteTimerSecondsLeft <= 30 ? 'text-orange-600' : 'text-secondary-500'}`}>
                {String(Math.floor(voteTimerSecondsLeft / 60)).padStart(2, '0')}:{String(voteTimerSecondsLeft % 60).padStart(2, '0')}
              </span>
            )}
            {isEligibleVoter && (
              <span className="text-xs text-secondary-500 font-medium">
                {voteRemaining} restant{voteRemaining !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => setShowVoteResults(true)}
              className="text-xs text-secondary-500 hover:text-secondary-700 font-medium underline-offset-2 hover:underline"
            >
              Résultats
            </button>
            {!isReadonly && voteTimerSecondsLeft !== null && (
              <div className="flex items-center gap-0.5">
                {[1, 2, 5].map((min) => (
                  <button
                    key={min}
                    onClick={() => extendVote(min * 60)}
                    className="text-[10px] font-bold text-secondary-500 hover:text-secondary-700 hover:bg-secondary-100 rounded px-1 py-0.5 transition-colors"
                    title={`Ajouter ${min} minute${min > 1 ? 's' : ''}`}
                  >
                    +{min}m
                  </button>
                ))}
              </div>
            )}
            {!isReadonly && (
              <button onClick={stopVote} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity" title="Terminer le vote">
                <svg className="w-3 h-3 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <>
            {!isReadonly && (
              <div ref={voteMenuContainerRef} className="relative shrink-0">
                <button
                  onClick={() => {
                    if (!showVoteMenu) {
                      closeAllDropdowns()
                      if (voteMenuContainerRef.current) setVoteMenuRect(voteMenuContainerRef.current.getBoundingClientRect())
                    }
                    setShowVoteMenu(!showVoteMenu)
                  }}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${showVoteMenu ? 'text-gray-900 bg-gray-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                  title="Vote"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Vote
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showVoteMenu && voteMenuRect && (
                  <div
                    style={{ position: 'fixed', top: templateDraftOf ? 170 : 120, left: voteMenuRect.left }}
                    className="w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[200]"
                  >
                    <button
                      onClick={() => { closeAllOverlays(); setShowVoteConfig(true) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                    >
                      <svg className="w-4 h-4 text-primary-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Lancer un vote
                    </button>
                    {lastVoteSession && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => { closeAllOverlays(); setShowLastVote(true) }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left"
                        >
                          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Dernier vote
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            {lastVoteSession && isReadonly && (
              <button
                onClick={() => setShowLastVote(true)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
                title="Voir le dernier vote"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Dernier vote
              </button>
            )}
          </>
        )}

        {/* Timer */}
        {timerSecondsLeft !== null ? (
          <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 shrink-0 ${timerSecondsLeft <= 10 ? 'bg-red-50 text-red-600' : timerSecondsLeft <= 30 ? 'bg-orange-50 text-orange-600' : 'bg-primary-50 text-primary-600'}`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3" />
            </svg>
            <span className="text-xs font-mono font-bold tabular-nums">
              {String(Math.floor(timerSecondsLeft / 60)).padStart(2, '0')}:{String(timerSecondsLeft % 60).padStart(2, '0')}
            </span>
            {!isReadonly && (
              <button onClick={stopTimer} className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity" title="Arrêter le timer">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : !isReadonly && (
          <div ref={timerPickerRef} className="relative shrink-0">
            <button
              onClick={() => {
                if (!showTimerPicker) {
                  closeAllDropdowns()
                  if (timerPickerRef.current) setTimerPickerRect(timerPickerRef.current.getBoundingClientRect())
                }
                setShowTimerPicker(!showTimerPicker)
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${showTimerPicker ? 'text-gray-900 bg-gray-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
              title="Lancer un timer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3" />
              </svg>
              Timer
            </button>
            {showTimerPicker && timerPickerRect && (
              <div
                style={{ position: 'fixed', top: templateDraftOf ? 170 : 120, left: timerPickerRect.left }}
                className="w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-3 z-[200]"
              >
                {/* Saisie libre */}
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 pb-2">Durée personnalisée</p>
                <div className="flex items-center gap-1.5 px-3 pb-3">
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={timerCustomMin}
                    onChange={(e) => setTimerCustomMin(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && launchCustomTimer()}
                    className="w-14 text-center text-sm font-mono font-semibold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="mm"
                  />
                  <span className="text-gray-400 font-bold">:</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={timerCustomSec}
                    onChange={(e) => setTimerCustomSec(e.target.value.padStart(2, '0'))}
                    onKeyDown={(e) => e.key === 'Enter' && launchCustomTimer()}
                    className="w-14 text-center text-sm font-mono font-semibold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    placeholder="ss"
                  />
                  <button
                    onClick={launchCustomTimer}
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg py-1.5 transition-colors"
                  >
                    Go
                  </button>
                </div>

                {/* Presets */}
                <div className="border-t border-gray-100 pt-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-3 pb-1">Raccourcis</p>
                  <div className="grid grid-cols-4 gap-1 px-3">
                    {[1, 2, 3, 5, 10, 15, 20, 25].map((min) => (
                      <button
                        key={min}
                        onClick={() => { startTimer(min * 60); setShowTimerPicker(false) }}
                        className="text-xs font-medium text-gray-600 hover:bg-primary-50 hover:text-primary-700 rounded-lg py-1.5 transition-colors"
                      >
                        {min}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
        {/* end activities group */}

        {/* ── Group: session ──────────────────────────────────────────────── */}
        {!isReadonly && <div className="w-px h-6 bg-gray-200 shrink-0" aria-hidden />}
        {!isReadonly && (!session ? (
          <button
            onClick={startSession}
            disabled={sessionLoading}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Session
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-bold text-green-700 font-mono tracking-widest">{session.code}</span>
            <span className="text-xs text-green-600">· {participantCount} 👤</span>
          </div>
        ))}

        {/* ── Overflow menu ── */}
        {!isReadonly && (
          <>
            <div className="w-px h-6 bg-gray-200 shrink-0" aria-hidden />
            <div ref={overflowMenuContainerRef} className="relative shrink-0">
              <button
                onClick={() => { if (!showOverflowMenu) closeAllDropdowns(); setShowOverflowMenu(!showOverflowMenu) }}
                className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${showOverflowMenu || showGroupsPanel ? 'text-primary-600 bg-primary-50 hover:bg-primary-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
                title="Plus d'outils"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
                {(groupCount > 0 || fields.length > 0) && !showOverflowMenu && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary-400" />
                )}
              </button>
              {showOverflowMenu && overflowMenuContainerRef.current && (
                <div
                  style={{ position: 'fixed', top: templateDraftOf ? 170 : 120, right: window.innerWidth - overflowMenuContainerRef.current.getBoundingClientRect().right }}
                  className="w-52 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-[200]"
                >
                  <button
                    onClick={() => {
                      setShowOverflowMenu(false)
                      if (overflowMenuContainerRef.current) setGroupsBtnRect(overflowMenuContainerRef.current.getBoundingClientRect())
                      setShowGroupsPanel(true)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${showGroupsPanel || highlightedGroupId ? 'text-primary-600 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="9" cy="7" r="3" strokeWidth={2} />
                      <circle cx="15" cy="7" r="3" strokeWidth={2} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 14c1.657 0 3 1.343 3 3v3" />
                    </svg>
                    <span className="flex-1">Groupes</span>
                    {groupCount > 0 && (
                      <span className="text-xs font-bold text-primary-500 bg-primary-50 rounded-full px-1.5 py-0.5">{groupCount}</span>
                    )}
                  </button>
                  <button
                    onClick={() => { setShowOverflowMenu(false); setShowGroupsPanel(false); setShowFieldsPanel(true) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${fields.length > 0 ? 'text-primary-600' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="flex-1">Champs</span>
                    {fields.length > 0 && (
                      <span className="text-xs font-bold text-primary-500 bg-primary-50 rounded-full px-1.5 py-0.5">{fields.length}</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Canvas area */}
      <div className="relative flex-1 overflow-hidden flex flex-col">
        {session && (
          <HostPanel
            session={session}
            participantCount={participantCount}
            currentActivity={currentActivity}
            activityResponses={activityResponses}
            lastReport={lastReport}
            onClearReport={clearLastReport}
            onLaunchActivity={launchActivity}
            onCloseActivity={closeActivity}
            onCloseSession={closeSession}
          />
        )}

        <BoardCanvas
          ref={canvasApiRef}
          boardName={board?.name}
          cards={cards}
          connections={connections}
          frames={frames}
          fields={fields}
          selectedIds={selectedIds}
          toolMode={toolMode}
          toolColor={toolColor}
          toolStroke={toolStroke}
          toolFill={toolFill}
          toolOpacity={toolOpacity}
          clipboard={clipboard}
          isReadonly={isReadonly}
          onAddCard={addCard}
          onMoveCard={moveCard}
          onResizeCard={resizeCard}
          onResizeCardBox={resizeCardBox}
          onUpdateCard={updateCard}
          onRecolorCard={recolorCard}
          onDeleteCard={deleteCard}
          onStartDragCard={startDragCard}
          onCommitDragCard={commitDragCard}
          onStartResizeCard={startResizeCard}
          onCommitResizeCard={commitResizeCard}
          onSelectCards={selectCards}
          onAddConnection={addConnection}
          onDeleteConnection={deleteConnection}
          onUpdateConnection={updateConnection}
          onMoveFrame={moveFrame}
          onStartDragFrame={startDragFrame}
          onCommitDragFrame={commitDragFrame}
          onResizeFrameBox={resizeFrameBox}
          onStartResizeFrame={startResizeFrame}
          onCommitResizeFrame={commitResizeFrame}
          onUpdateFrame={updateFrame}
          onSetFrameActive={setFrameActive}
          onDeleteFrame={deleteFrame}
          onSetFieldValue={setFieldValue}
          onClearFieldValue={clearFieldValue}
          onExitLinkCardsMode={() => setToolMode('select')}
          onPasteCards={(clipCards, x, y) => {
            pasteCards(clipCards, x, y)
            setClipboard([])
            try { localStorage.removeItem('klx_clipboard') } catch {}
          }}
          voteSession={activeVoteSession}
          voteCanVote={voteCanVote}
          currentUserId={currentUserId}
          onCastVote={castVote}
          onUncastVote={uncastVote}
          onSetCardLocked={(id, locked) => lockCards([id], locked)}
          consumeAutoEdit={consumeAutoEdit}
          remoteEditors={remoteEditors}
          onEditingChange={notifyEditing}
          onSetFrameLayer={setFrameLayer}
          highlightedGroupId={highlightedGroupId}
          cursors={cursors}
          onCursorMove={(x, y) => emitCursor(id, x, y)}
        />

        {/* Activity overlay for authenticated board members (non-owner) */}
        {userRole !== 'OWNER' && boardSession.activeSession && boardSession.currentActivity && (
          <MemberActivityOverlay
            activity={boardSession.currentActivity}
            hasResponded={boardSession.hasResponded}
            onRespond={boardSession.respond}
          />
        )}

        {timerExpired && (
          <TimerOverlay onDismiss={() => setTimerDismissed(true)} />
        )}

        {showVoteEnd && activeVoteSession && (
          <VoteEndOverlay
            onShowResults={() => { setShowVoteEnd(false); setShowVoteResults(true) }}
          />
        )}

        {!isReadonly && (
          <FloatingToolbar
            toolMode={toolMode}
            toolColor={toolColor}
            toolStroke={toolStroke}
            toolFill={toolFill}
            toolOpacity={toolOpacity}
            minTop={templateDraftOf ? 170 : 120}
            onToolChange={handleToolChange}
            onAddFrame={() => addFrame(200, 200)}
            frameLimitReached={frames.length >= MAX_FRAMES_PER_BOARD}
          />
        )}

        {/* Floating selection bar */}
        {selectedIds.size > 0 && !isReadonly && (
          <div data-popover-anchor className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[46] flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-2xl shadow-black/15 px-3 py-2">
            <span className="text-xs font-medium text-gray-500 pr-0.5 shrink-0">
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </span>
            <div className="w-px h-4 bg-gray-200" />
            <ColorPopover
              value={selectedCards[0]?.color ?? '#eab308'}
              onChange={(c) => recolorSelected(c)}
              title="Colorier la sélection"
              align="left"
            />
            {(() => {
              const lockable = cards.filter((c) => selectedIds.has(c.id) && c.type !== 'DRAW')
              if (lockable.length === 0) return null
              const allLocked = lockable.every((c) => c.locked)
              const anyLocked = lockable.some((c) => c.locked)
              return (
                <>
                  <div className="w-px h-4 bg-gray-200" />
                  <button
                    onClick={() => lockSelected(allLocked ? false : true)}
                    className={`flex items-center gap-1 text-xs font-medium transition-colors px-1.5 py-1 rounded-lg ${anyLocked ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                    title={allLocked ? 'Déverrouiller la sélection' : 'Verrouiller la sélection'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {allLocked
                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6-6h12a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6a2 2 0 012-2zm10-4a4 4 0 10-8 0v4h8V9z" />
                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                      }
                    </svg>
                    {allLocked ? 'Déverr.' : 'Verr.'}
                  </button>
                </>
              )
            })()}
            {canGroup && (
              <>
                <div className="w-px h-4 bg-gray-200" />
                <button
                  onClick={groupSelected}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
                  title={allInSameGroup ? 'Dégrouper' : 'Grouper'}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {allInSameGroup
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m-4 12h2a2 2 0 002-2v-2" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18" />
                    }
                  </svg>
                  {allInSameGroup ? 'Dégrouper' : 'Grouper'}
                </button>
                <div className="flex items-center gap-0.5 rounded-lg bg-gray-50 border border-gray-200 px-1 py-1 shrink-0">
                  <button onClick={() => arrangeSelected('column')} title="Aligner en colonne" className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-800 hover:bg-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="8" y="3" width="8" height="5" rx="1" strokeWidth={2} />
                      <rect x="8" y="10" width="8" height="5" rx="1" strokeWidth={2} />
                      <rect x="8" y="17" width="8" height="5" rx="1" strokeWidth={2} />
                    </svg>
                  </button>
                  <button onClick={() => arrangeSelected('row')} title="Aligner en ligne" className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-800 hover:bg-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="8" width="5" height="8" rx="1" strokeWidth={2} />
                      <rect x="10" y="8" width="5" height="8" rx="1" strokeWidth={2} />
                      <rect x="17" y="8" width="5" height="8" rx="1" strokeWidth={2} />
                    </svg>
                  </button>
                  <button onClick={() => arrangeSelected('grid')} title="Aligner en grille" className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-800 hover:bg-white transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={2} />
                      <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={2} />
                      <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={2} />
                      <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth={2} />
                    </svg>
                  </button>
                </div>
              </>
            )}
            <div className="w-px h-4 bg-gray-200" />
            {(() => {
              const selLayer = (() => {
                const layers = selectedCards.map((c) => c.layer ?? 1)
                return layers.every((l) => l === layers[0]) ? layers[0] : null
              })()
              return (
                <div className="flex items-center rounded-lg bg-gray-50 border border-gray-200 overflow-hidden shrink-0">
                  {([0, 1, 2] as const).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLayerSelected(l)}
                      title={l === 0 ? 'Arrière-plan' : l === 1 ? 'Plan principal' : 'Avant-plan'}
                      className={`w-7 h-7 flex items-center justify-center transition-colors ${selLayer === l ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-primary-600 hover:bg-gray-100'}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {l === 0 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />}
                        {l === 1 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14" />}
                        {l === 2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />}
                      </svg>
                    </button>
                  ))}
                </div>
              )
            })()}
            <div className="w-px h-4 bg-gray-200" />
            <button
              onClick={deleteSelected}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Supprimer (Suppr)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Groups panel */}
      {showGroupsPanel && (
        <GroupsPanel
          cards={cards}
          highlightedGroupId={highlightedGroupId}
          onHighlight={setHighlightedGroupId}
          onRecolor={recolorGroup}
          onDelete={(gid) => { ungroupById(gid); if (highlightedGroupId === gid) setHighlightedGroupId(null) }}
          onClose={() => { setShowGroupsPanel(false); setHighlightedGroupId(null) }}
          top={templateDraftOf ? 170 : 120}
          right={groupsBtnRect ? window.innerWidth - groupsBtnRect.right : 16}
          onMouseEnter={() => { if (groupsLeaveTimer.current) clearTimeout(groupsLeaveTimer.current) }}
          onMouseLeave={handleGroupsLeave}
        />
      )}

      {/* Fields panel modal */}
      {showFieldsPanel && (
        <BoardFieldsPanel
          fields={fields}
          onCreate={createField}
          onUpdate={updateField}
          onDelete={deleteField}
          onClose={() => setShowFieldsPanel(false)}
        />
      )}

      {showSettingsModal && board && (
        <BoardSettingsModal
          board={{
            id: board.id,
            name: board.name,
            description: board.description,
            coverImage: board.coverImage,
            maxParticipants: board.maxParticipants,
            enabledActivities: board.enabledActivities,
            templateDraftOf: board.templateDraftOf,
          }}
          onClose={() => setShowSettingsModal(false)}
          onSave={updateBoardInfo}
        />
      )}

      {/* Hidden image file input */}
      <input
        ref={imageImportRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageImport}
      />

      {showImportHub && (
        <ImportHubModal
          onClose={() => setShowImportHub(false)}
          onPickKlaxoon={() => { setShowImportHub(false); setShowImportKlaxoon(true) }}
          onPickPdf={() => { setShowImportHub(false); setShowImportPdf(true) }}
          onPickImage={() => { setShowImportHub(false); imageImportRef.current?.click() }}
        />
      )}

      {showImportKlaxoon && (
        <ImportKlaxoonModal boardId={id} onClose={() => setShowImportKlaxoon(false)} />
      )}

      {showImportPdf && (
        <ImportPdfModal onClose={() => setShowImportPdf(false)} onImport={handlePdfImport} />
      )}

      {showShareModal && (
        <ShareModal boardId={id} onClose={() => setShowShareModal(false)} />
      )}

      {showExportHub && (
        <ExportHubModal onClose={() => setShowExportHub(false)} onExport={handleExport} />
      )}

      {showVoteConfig && (
        <VoteConfigModal
          members={members}
          currentUserId={currentUserId}
          onStart={startVote}
          onClose={() => setShowVoteConfig(false)}
        />
      )}

      {showVoteResults && activeVoteSession && (
        <VoteResultsPanel
          session={activeVoteSession}
          cards={cards}
          isOwner={userRole === 'OWNER'}
          onClose={() => setShowVoteResults(false)}
          onStopVote={stopVote}
        />
      )}

      {showLastVote && lastVoteSession && (
        <VoteResultsPanel
          session={lastVoteSession}
          cards={cards}
          isHistory
          onClose={() => setShowLastVote(false)}
        />
      )}
    </div>
  )
}

// ── Activity overlay for authenticated non-owner board members ────────────────

interface MemberActivity {
  id: string
  type: string
  title: string
  config: Record<string, unknown>
}

function MemberActivityOverlay({
  activity,
  hasResponded,
  onRespond,
}: {
  activity: MemberActivity
  hasResponded: boolean
  onRespond: (id: string, value: unknown) => void
}) {
  const [text, setText] = useState('')
  const isPoll = activity.type === 'POLL' || activity.type === 'QUIZ'
  const options = activity.config.options as string[] | undefined

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-primary-600 px-4 py-3">
          <p className="text-xs font-semibold text-primary-200 uppercase tracking-widest mb-0.5">
            {activity.type === 'QUIZ' ? 'Quiz' : activity.type === 'POLL' ? 'Sondage' : activity.type === 'WORDCLOUD' ? 'Nuage de mots' : 'Brainstorming'}
          </p>
          <h3 className="text-white font-semibold text-sm leading-snug">{activity.title}</h3>
        </div>

        {/* Body */}
        <div className="p-4">
          {hasResponded ? (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-medium text-gray-800">Réponse envoyée !</p>
                <p className="text-gray-400 text-xs">En attente de la prochaine activité…</p>
              </div>
            </div>
          ) : isPoll && options ? (
            <div className="flex flex-col gap-2">
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onRespond(activity.id, i)}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-left hover:border-primary-300 hover:bg-primary-50 transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) onRespond(activity.id, text.trim()) }} className="flex gap-2">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={activity.type === 'WORDCLOUD' ? 'Un mot…' : 'Votre idée…'}
                autoFocus
                maxLength={activity.type === 'WORDCLOUD' ? 30 : 200}
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
              >
                Envoyer
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
