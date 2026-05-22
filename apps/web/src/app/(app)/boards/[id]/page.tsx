'use client'

import { use, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useBoard } from '@/hooks/useBoard'
import type { Card } from '@/hooks/useBoard'
import { useSession } from '@/hooks/useSession'
import { BoardCanvas } from '@/components/board/board-canvas'
import { BoardFieldsPanel } from '@/components/board/board-fields-panel'
import { HostPanel } from '@/components/session/host-panel'
import { FloatingToolbar } from '@/components/board/floating-toolbar'
import type { ToolMode, StrokeSize } from '@/components/board/floating-toolbar'

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const {
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
  } = useBoard(id)
  const {
    session, participantCount, currentActivity, activityResponses, isLoading: sessionLoading,
    startSession, closeSession, launchActivity, closeActivity,
  } = useSession(id)

  type ClipCard = Pick<Card, 'type' | 'content' | 'color' | 'posX' | 'posY' | 'width' | 'height'>
  const [clipboard, setClipboard] = useState<ClipCard[]>([])

  const [showFieldsPanel, setShowFieldsPanel] = useState(false)
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
    setToolMode(tool)
    if (color !== undefined) setToolColor(color)
    if (stroke !== undefined) setToolStroke(stroke)
    if (fill !== undefined) setToolFill(fill)
    if (opacity !== undefined) setToolOpacity(opacity)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
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
        setClipboard(sel.map(({ type, content, color, posX, posY, width, height }) => ({ type, content, color, posX, posY, width, height })))
        return
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) deleteSelected()
      }
      if (e.key === 'Escape') { setToolMode('select'); selectCards(new Set()) }
      if ((e.key === 'v' || e.key === 'V') && !e.ctrlKey && !e.metaKey) setToolMode('select')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, deleteSelected, selectCards, cards, undo, redo])

  function handlePasteCards(cb: ClipCard[], canvasX: number, canvasY: number) {
    if (cb.length === 0) return
    const minX = Math.min(...cb.map((c) => c.posX))
    const minY = Math.min(...cb.map((c) => c.posY))
    const maxX = Math.max(...cb.map((c) => c.posX + c.width))
    const maxY = Math.max(...cb.map((c) => c.posY + c.height))
    const dx = canvasX - (minX + maxX) / 2
    const dy = canvasY - (minY + maxY) / 2
    cb.forEach(({ type, content, color, posX, posY, width, height }) => {
      addCard(posX + dx, posY + dy, type, content, color, width, height)
    })
  }

  const selectedCards = cards.filter((c) => selectedIds.has(c.id))
  const selectedGroupIds = new Set(selectedCards.map((c) => c.groupId).filter(Boolean))
  const allInSameGroup = selectedGroupIds.size === 1 && selectedCards.every((c) => c.groupId !== null)
  const canGroup = selectedIds.size >= 2

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200 shrink-0 overflow-x-auto">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors mr-1 shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <h1 className="font-semibold text-gray-900 flex-1 truncate min-w-0">{board?.name}</h1>

        {/* Undo / Redo */}
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
        </div>

        {/* Reset board */}
        <button
          onClick={handleResetClick}
          title={confirmReset ? 'Cliquer pour confirmer la réinitialisation' : 'Réinitialiser le board'}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors shrink-0 ${
            confirmReset
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {confirmReset ? 'Confirmer ?' : 'Reset'}
        </button>

        {/* Selection badge */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-1.5 shrink-0">
            <span className="text-xs font-medium text-indigo-700">
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </span>
            <div className="w-px h-4 bg-indigo-200" />
            {['#FEF08A', '#86EFAC', '#93C5FD', '#F9A8D4', '#FCA5A5', '#C4B5FD', '#FED7AA'].map((c) => (
              <button
                key={c}
                title={`Colorier en ${c}`}
                onClick={() => recolorSelected(c)}
                className="w-4 h-4 rounded-full border border-white shadow-sm hover:scale-125 transition-transform"
                style={{ background: c }}
              />
            ))}
            <div className="w-px h-4 bg-indigo-200" />
            <button onClick={deleteSelected} className="text-red-400 hover:text-red-600 transition-colors" title="Supprimer (Suppr)">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}

        {/* Grouper */}
        {canGroup && (
          <button onClick={groupSelected} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {allInSameGroup
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m-4 12h2a2 2 0 002-2v-2" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M14 3v18" />
              }
            </svg>
            {allInSameGroup ? 'Dégrouper' : 'Grouper'}
          </button>
        )}

        {/* Cadre */}
        <button
          onClick={() => addFrame(200, 200)}
          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0"
          title="Ajouter un cadre"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} strokeLinecap="round" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9h18M9 21V9" />
          </svg>
          Cadre
        </button>

        {/* Champs */}
        <button
          onClick={() => setShowFieldsPanel(true)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors shrink-0 ${fields.length > 0 ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
          title="Gérer les champs personnalisés"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Champs{fields.length > 0 ? ` (${fields.length})` : ''}
        </button>

        {!session ? (
          <button
            onClick={startSession}
            disabled={sessionLoading}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 shrink-0"
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
            onLaunchActivity={launchActivity}
            onCloseActivity={closeActivity}
            onCloseSession={closeSession}
          />
        )}

        <BoardCanvas
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
          onAddCard={addCard}
          onMoveCard={moveCard}
          onResizeCard={resizeCard}
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
          onMoveFrame={moveFrame}
          onStartDragFrame={startDragFrame}
          onCommitDragFrame={commitDragFrame}
          onResizeFrame={resizeFrame}
          onStartResizeFrame={startResizeFrame}
          onCommitResizeFrame={commitResizeFrame}
          onUpdateFrame={updateFrame}
          onDeleteFrame={deleteFrame}
          onSetFieldValue={setFieldValue}
          onClearFieldValue={clearFieldValue}
          onExitLinkCardsMode={() => setToolMode('select')}
          onPasteCards={handlePasteCards}
        />

        <FloatingToolbar
          toolMode={toolMode}
          toolColor={toolColor}
          toolStroke={toolStroke}
          toolFill={toolFill}
          toolOpacity={toolOpacity}
          onToolChange={handleToolChange}
        />
      </div>

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
    </div>
  )
}
