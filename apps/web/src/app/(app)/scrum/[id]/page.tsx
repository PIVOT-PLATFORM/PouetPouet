'use client'

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { useScrum, ESTIMATION_SCALES } from '@/hooks/useScrum'
import type { ScrumTicket } from '@/hooks/useScrum'
import { useAuthStore } from '@/store/auth'

function statusLabel(status: ScrumTicket['status']) {
  return { PENDING: 'En attente', VOTING: 'Vote en cours', REVEALED: 'Révélé', DONE: 'Estimé' }[status]
}
function statusColor(status: ScrumTicket['status']) {
  return {
    PENDING:  'bg-gray-100 text-gray-500',
    VOTING:   'bg-amber-100 text-amber-700',
    REVEALED: 'bg-blue-100 text-blue-700',
    DONE:     'bg-green-100 text-green-700',
  }[status]
}

function VoteCard({ value, name }: { value: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-14 h-20 rounded-xl bg-white border-2 border-primary-300 shadow-md flex items-center justify-center">
        <span className="text-xl font-bold text-primary-700 leading-tight text-center px-1">{value}</span>
      </div>
      <span className="text-xs text-gray-500 text-center max-w-[56px] truncate">{name}</span>
    </div>
  )
}

function HiddenCard() {
  return (
    <div className="w-14 h-20 rounded-xl bg-gradient-to-br from-primary-500 to-secondary-600 shadow-md flex items-center justify-center">
      <span className="text-white text-2xl">🃏</span>
    </div>
  )
}

export default function ScrumRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { user } = useAuthStore()
  const {
    room, participantCount, participantNames, isLoading,
    addTicket, bulkAddTickets, activateTicket, reveal, vote,
    setEstimate, bulkEstimate, resetTicket, deleteTicket, updateScale,
    setQueue, clearQueue, kickParticipant, clearParticipants,
  } = useScrum(id)

  const [newTicketTitle, setNewTicketTitle] = useState('')
  const [selectedEstimate, setSelectedEstimate] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Import en masse
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importTab, setImportTab] = useState<'text' | 'excel'>('text')
  const [excelTitles, setExcelTitles] = useState<string[]>([])
  const [excelFileName, setExcelFileName] = useState('')

  // Sélection pour estimation / suppression en masse
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set())
  const [showBatchPicker, setShowBatchPicker] = useState(false)

  // Participation de l'hôte au vote
  const [hostParticipating, setHostParticipating] = useState<boolean | null>(null)
  const [hostVote, setHostVote] = useState<string | null>(null)

  // Panneau participants (kick)
  const [showParticipants, setShowParticipants] = useState(false)

  // File d'estimation : mode construction + brouillon ordonné de ticketIds
  const [queueMode, setQueueMode] = useState(false)
  const [queueDraft, setQueueDraft] = useState<string[]>([])

  const activeTicket = room?.tickets.find((t) => t.status === 'VOTING' || t.status === 'REVEALED') ?? null
  const scaleInfo = ESTIMATION_SCALES[room?.scale ?? 'FIBONACCI'] ?? ESTIMATION_SCALES.FIBONACCI

  // Réinitialiser le vote de l'hôte à chaque nouveau ticket actif
  useEffect(() => { setHostVote(null) }, [activeTicket?.id])

  function copyLink() {
    if (!room) return
    const url = `${window.location.origin}/scrum/join/${room.code}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleAddTicket(e: React.FormEvent) {
    e.preventDefault()
    if (!newTicketTitle.trim()) return
    addTicket(newTicketTitle.trim())
    setNewTicketTitle('')
  }

  function handleImport(e: React.FormEvent) {
    e.preventDefault()
    const titles = importText.split('\n').map((s) => s.trim()).filter(Boolean)
    if (titles.length === 0) return
    bulkAddTickets(titles)
    setImportText('')
    setShowImport(false)
  }

  async function handleExcelFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls)$/i)) return
    const { read, utils } = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = read(buf)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][]
    const titles = rows.slice(1).map((r) => String(r[0] ?? '').trim()).filter(Boolean)
    setExcelTitles(titles)
    setExcelFileName(file.name)
  }

  function handleExcelImport() {
    if (excelTitles.length === 0) return
    bulkAddTickets(excelTitles)
    setExcelTitles([])
    setExcelFileName('')
    setShowImport(false)
  }

  function downloadTemplate() {
    import('xlsx').then(({ utils, writeFile }) => {
      const ws = utils.aoa_to_sheet([
        ['Titre'],
        ['US-001 Page de connexion'],
        ['US-002 Dashboard'],
        ['US-003 Profil utilisateur'],
      ])
      ws['!cols'] = [{ wch: 40 }]
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, 'Tickets')
      writeFile(wb, 'template-scrum-tickets.xlsx')
    })
  }

  function handleSetEstimate() {
    if (!activeTicket || !selectedEstimate || !room) return
    setEstimate(activeTicket.id, selectedEstimate, room.scale)
    setSelectedEstimate(null)
  }

  function toggleTicketSelect(ticketId: string) {
    setSelectedTicketIds((prev) => {
      const next = new Set(prev)
      if (next.has(ticketId)) next.delete(ticketId)
      else next.add(ticketId)
      return next
    })
  }

  function handleBatchEstimate(value: string) {
    if (!room) return
    bulkEstimate([...selectedTicketIds], value, room.scale)
    setSelectedTicketIds(new Set())
    setShowBatchPicker(false)
  }

  function handleBatchDelete() {
    for (const id of selectedTicketIds) deleteTicket(id)
    setSelectedTicketIds(new Set())
  }

  // Retourne l'estimation de la scale courante pour un ticket donné
  function currentScaleEstimate(ticket: ScrumTicket) {
    return room?.scale === 'TIME' ? ticket.estimateTime : ticket.estimate
  }

  // Un ticket peut être (re)activé si : PENDING, ou DONE mais sans estimation sur la scale courante
  function canActivate(ticket: ScrumTicket) {
    return (ticket.status === 'PENDING' || ticket.status === 'DONE') && activeTicket?.id !== ticket.id
  }

  // ── File d'estimation ──
  // Un ticket reste à estimer s'il n'a pas d'estimation sur la scale courante.
  function needsEstimate(ticket: ScrumTicket) {
    return !(room?.scale === 'TIME' ? ticket.estimateTime : ticket.estimate)
  }
  function toggleQueueDraft(ticketId: string) {
    setQueueDraft((prev) => prev.includes(ticketId) ? prev.filter((x) => x !== ticketId) : [...prev, ticketId])
  }
  function enterQueueMode() {
    setSelectedTicketIds(new Set()) // éviter la confusion avec la sélection batch
    setQueueMode(true)
  }
  function cancelQueueBuild() { setQueueDraft([]); setQueueMode(false) }
  function startQueue() {
    if (!room || queueDraft.length === 0) return
    setQueue(queueDraft, room.scale)
    setQueueDraft([])
    setQueueMode(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    )
  }

  if (!room) {
    return <div className="text-center py-24 text-gray-400">Salle introuvable</div>
  }

  const pendingTickets = room.tickets.filter((t) => t.status === 'PENDING')
  const ticketsById = new Map(room.tickets.map((t) => [t.id, t]))
  const queueActive = room.queue.length > 0

  return (
    <div className="flex flex-col h-full gap-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/scrum" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{room.name}</h1>

        <button
          onClick={copyLink}
          title="Copier le lien d'invitation"
          className="flex items-center gap-1.5 rounded-lg bg-primary-50 border border-primary-200 px-3 py-1.5 text-sm font-mono font-bold text-primary-700 hover:bg-primary-100 transition-colors"
        >
          {room.code}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {copied && <span className="text-green-600 font-normal text-xs">Lien copié !</span>}
        </button>

        {/* Participants */}
        <div className="relative">
          <button
            onClick={() => setShowParticipants((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg px-3 py-1.5 hover:bg-gray-200 transition-colors select-none"
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {participantCount} participant{participantCount !== 1 ? 's' : ''}
          </button>
          {showParticipants && (
            <div
              className="absolute top-full left-0 mt-1.5 z-30 min-w-[180px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl shadow-xl"
              onMouseLeave={() => setShowParticipants(false)}
            >
              {participantNames.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-2">Aucun participant</p>
              ) : (
                <div className="py-1">
                  {participantNames.map((name) => (
                    <div key={name} className="group/row flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                      <span className="text-xs text-gray-700 dark:text-gray-200 flex-1 truncate">{name}</span>
                      <button
                        onClick={() => kickParticipant(name)}
                        title="Exclure"
                        className="opacity-0 group-hover/row:opacity-100 text-gray-300 hover:text-red-500 transition-opacity text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {participantNames.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-1.5">
                  <button
                    onClick={() => { clearParticipants(); setShowParticipants(false) }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium w-full text-left"
                  >
                    Vider la salle
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scale toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 ml-auto">
          {Object.entries(ESTIMATION_SCALES).map(([key, info]) => (
            <button
              key={key}
              onClick={() => updateScale(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                room.scale === key
                  ? 'bg-white text-primary-700 shadow-sm font-semibold'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {info.label}
            </button>
          ))}
        </div>

      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* ── Left: Ticket list ── */}
        <div className="w-80 shrink-0 flex flex-col gap-3">
          {/* Add ticket form */}
          <form onSubmit={handleAddTicket} className="flex gap-2">
            <input
              type="text"
              placeholder="Ajouter un ticket…"
              value={newTicketTitle}
              onChange={(e) => setNewTicketTitle(e.target.value)}
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            <button
              type="submit"
              disabled={!newTicketTitle.trim()}
              title="Ajouter"
              className="rounded-xl bg-primary-600 px-3 py-2 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setShowImport(!showImport)}
              title="Importer en masse"
              className={`rounded-xl border px-3 py-2 text-sm transition-colors ${showImport ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </button>
          </form>

          {/* Bulk import panel */}
          {showImport && (
            <div className="flex flex-col gap-2 bg-primary-50 border border-primary-200 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-primary-700">Importer plusieurs tickets</p>
                <div className="flex gap-1 bg-white border border-primary-200 rounded-lg p-0.5">
                  {(['text', 'excel'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setImportTab(tab)}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                        importTab === tab ? 'bg-primary-600 text-white' : 'text-primary-600 hover:bg-primary-50'
                      }`}
                    >
                      {tab === 'text' ? 'Texte' : 'Excel'}
                    </button>
                  ))}
                </div>
              </div>

              {importTab === 'text' ? (
                <form onSubmit={handleImport} className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={"Un ticket par ligne :\nLogin page\nDashboard\nUser settings…"}
                    rows={5}
                    className="w-full text-sm border border-primary-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none bg-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowImport(false); setImportText('') }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={!importText.trim()}
                      className="px-3 py-1.5 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40"
                    >
                      Importer ({importText.split('\n').filter((l) => l.trim()).length})
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-primary-200 rounded-xl px-3 py-4 cursor-pointer hover:border-primary-400 hover:bg-white/60 transition-colors">
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="sr-only"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleExcelFile(f) }}
                    />
                    <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs text-primary-600 font-medium">
                      {excelFileName || 'Choisir un fichier .xlsx'}
                    </span>
                    {excelTitles.length > 0 && (
                      <span className="text-[11px] text-green-600 font-semibold">
                        {excelTitles.length} ticket{excelTitles.length > 1 ? 's' : ''} détecté{excelTitles.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="text-[11px] text-primary-500 hover:text-primary-700 hover:underline text-left"
                  >
                    Télécharger le modèle Excel
                  </button>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => { setShowImport(false); setExcelTitles([]); setExcelFileName('') }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={handleExcelImport}
                      disabled={excelTitles.length === 0}
                      className="px-3 py-1.5 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40"
                    >
                      Importer ({excelTitles.length})
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── File d'estimation ── */}
          {queueActive ? (
            <div className="flex flex-col gap-2 bg-secondary-50 border border-secondary-200 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-secondary-700">
                  File · {room.queue.length} à estimer
                </p>
                <button onClick={clearQueue} className="text-xs text-gray-400 hover:text-red-500 font-medium">
                  Arrêter
                </button>
              </div>
              <ol className="flex flex-col gap-1">
                {room.queue.map((qid, i) => {
                  const t = ticketsById.get(qid)
                  if (!t) return null
                  return (
                    <li key={qid} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1 ${i === 0 ? 'bg-secondary-600 text-white font-semibold' : 'text-secondary-700'}`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${i === 0 ? 'bg-white text-secondary-700' : 'bg-secondary-200 text-secondary-700'}`}>{i + 1}</span>
                      <span className="truncate flex-1">{t.title}</span>
                      {i === 0 && <span className="text-[10px] opacity-90">en cours</span>}
                    </li>
                  )
                })}
              </ol>
            </div>
          ) : queueMode ? (
            <div className="flex flex-col gap-2 bg-secondary-50 border border-secondary-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-secondary-700">Cliquez les tickets dans l'ordre de passage</p>
              {queueDraft.length > 0 && (
                <ol className="flex flex-col gap-1">
                  {queueDraft.map((qid, i) => (
                    <li key={qid} className="flex items-center gap-2 text-xs text-secondary-700">
                      <span className="w-4 h-4 rounded-full bg-secondary-200 flex items-center justify-center text-[10px] shrink-0">{i + 1}</span>
                      <span className="truncate flex-1">{ticketsById.get(qid)?.title}</span>
                      <button onClick={() => toggleQueueDraft(qid)} className="text-gray-400 hover:text-red-500" title="Retirer">×</button>
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={cancelQueueBuild} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">Annuler</button>
                <button
                  onClick={startQueue}
                  disabled={queueDraft.length === 0}
                  className="px-3 py-1.5 text-xs font-semibold bg-secondary-600 text-white rounded-lg hover:bg-secondary-700 disabled:opacity-40"
                >
                  Démarrer la file ({queueDraft.length})
                </button>
              </div>
            </div>
          ) : (
            room.tickets.some(needsEstimate) && (
              <button
                onClick={enterQueueMode}
                className="flex items-center justify-center gap-1.5 text-xs font-medium text-secondary-600 border border-secondary-200 rounded-xl px-3 py-2 hover:bg-secondary-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Créer une file d'estimation
              </button>
            )
          )}

          {/* Batch action bar */}
          {selectedTicketIds.size > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <span className="text-xs font-semibold text-amber-700 flex-1">
                {selectedTicketIds.size} ticket{selectedTicketIds.size > 1 ? 's' : ''} sélectionné{selectedTicketIds.size > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setSelectedTicketIds(new Set())}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={handleBatchDelete}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Supprimer les tickets sélectionnés"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={() => setShowBatchPicker(true)}
                className="px-2.5 py-1 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600"
              >
                Estimer →
              </button>
            </div>
          )}

          {/* Ticket list */}
          <div className="flex flex-col gap-2 overflow-y-auto">
            {room.tickets.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Aucun ticket</p>
            )}
            {room.tickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`group rounded-xl border p-3 transition-all ${
                  activeTicket?.id === ticket.id
                    ? 'border-primary-300 bg-primary-50'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  {/* Mode file : bouton d'ordre ; sinon checkbox de sélection batch */}
                  {queueMode ? (
                    needsEstimate(ticket) && (
                      <button
                        onClick={() => toggleQueueDraft(ticket.id)}
                        className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                          queueDraft.includes(ticket.id)
                            ? 'bg-secondary-600 text-white border-secondary-600'
                            : 'border-gray-300 text-gray-400 hover:border-secondary-400'
                        }`}
                        title={queueDraft.includes(ticket.id) ? 'Retirer de la file' : 'Ajouter à la file'}
                      >
                        {queueDraft.includes(ticket.id) ? queueDraft.indexOf(ticket.id) + 1 : '+'}
                      </button>
                    )
                  ) : (
                    ticket.status === 'PENDING' && activeTicket?.id !== ticket.id && (
                      <input
                        type="checkbox"
                        checked={selectedTicketIds.has(ticket.id)}
                        onChange={() => toggleTicketSelect(ticket.id)}
                        className="mt-0.5 shrink-0 accent-primary-600"
                        onClick={(e) => e.stopPropagation()}
                      />
                    )
                  )}
                  <p className="text-sm font-medium text-gray-800 leading-snug flex-1">{ticket.title}</p>

                  {/* Estimate badges — one per scale */}
                  {(ticket.estimate || ticket.estimateTime) && (
                    <div className="shrink-0 flex items-center gap-1">
                      {ticket.estimate && (
                        <span className="text-xs font-bold bg-primary-100 text-primary-700 rounded-lg px-2 py-0.5 whitespace-nowrap">
                          {ticket.estimate} pts
                        </span>
                      )}
                      {ticket.estimate && ticket.estimateTime && (
                        <span className="text-gray-300 text-xs">·</span>
                      )}
                      {ticket.estimateTime && (
                        <span className="text-xs font-bold bg-green-100 text-green-700 rounded-lg px-2 py-0.5 whitespace-nowrap">
                          {ticket.estimateTime}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => deleteTicket(ticket.id)}
                    className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Supprimer"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusColor(ticket.status)}`}>
                    {statusLabel(ticket.status)}
                  </span>
                  {canActivate(ticket) && (
                    <button
                      onClick={() => activateTicket(ticket.id, room.scale)}
                      className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                    >
                      {currentScaleEstimate(ticket) ? 'Re-voter →' : 'Voter →'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Active ticket ── */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-6 flex flex-col">
          {!activeTicket ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <span className="text-5xl">🃏</span>
              <p className="text-gray-400 text-sm">Sélectionnez un ticket pour lancer le vote</p>
              {pendingTickets.length > 0 && (
                <p className="text-xs text-gray-400">
                  Ou cochez plusieurs tickets PENDING pour les estimer directement sans vote
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs font-medium text-primary-500 uppercase tracking-wide mb-1">Ticket en cours</p>
                  <h2 className="text-xl font-bold text-gray-900">{activeTicket.title}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{scaleInfo.label}</span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor(activeTicket.status)}`}>
                    {statusLabel(activeTicket.status)}
                  </span>
                </div>
              </div>

              {/* VOTING state */}
              {activeTicket.status === 'VOTING' && (() => {
                const hostName = user?.name ?? 'Hôte'
                const totalExpected = participantNames.length + (hostParticipating === true ? 1 : 0)
                const participantVoted = participantNames.filter((n) => activeTicket.votes.some((v) => v.participantName === n)).length
                const totalVoted = participantVoted + (hostVote ? 1 : 0)
                return (
                  <>
                    <div className="flex-1 flex flex-col gap-5 min-h-0">
                      {/* Cards — gradient si voté, pointillés si en attente */}
                      <div className="flex-1 flex flex-wrap gap-3 justify-center items-center content-center">
                        {Array(totalVoted).fill(null).map((_, i) => <HiddenCard key={`v-${i}`} />)}
                        {Array(Math.max(0, totalExpected - totalVoted)).fill(null).map((_, i) => (
                          <div key={`p-${i}`} className="w-14 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center">
                            <span className="text-gray-300 text-xl">?</span>
                          </div>
                        ))}
                      </div>

                      {/* Section participants */}
                      <div className="border-t border-gray-100 pt-4 shrink-0">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
                          {totalVoted} / {totalExpected} participants ont voté
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {/* Hôte */}
                          <div className={`col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                            hostVote ? 'bg-green-50 text-green-700' : hostParticipating === false ? 'bg-gray-50 text-gray-400' : 'bg-primary-50 text-primary-700'
                          }`}>
                            <span className="w-4 h-4 flex items-center justify-center shrink-0 text-sm leading-none">👑</span>
                            <span className="truncate font-medium">{hostName}</span>
                            {hostParticipating === null && (
                              <div className="ml-auto flex gap-1.5 shrink-0">
                                <button onClick={() => setHostParticipating(true)} className="px-2 py-0.5 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                                  Je vote
                                </button>
                                <button onClick={() => setHostParticipating(false)} className="px-2 py-0.5 text-xs font-medium border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-100">
                                  J'observe
                                </button>
                              </div>
                            )}
                            {hostParticipating === false && <span className="ml-auto text-xs text-gray-400 italic">Observateur</span>}
                            {hostParticipating === true && !hostVote && <span className="ml-auto text-xs text-primary-400">En attente…</span>}
                            {hostVote && <span className="ml-auto text-xs font-bold">✓</span>}
                          </div>

                          {/* Participants */}
                          {participantNames.map((name) => {
                            const hasVoted = activeTicket.votes.some((v) => v.participantName === name)
                            return (
                              <div key={name} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                                hasVoted ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
                              }`}>
                                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                  <span className={`w-2 h-2 rounded-full ${hasVoted ? 'bg-green-400' : 'bg-gray-300'}`} />
                                </div>
                                <span className="truncate font-medium">{name}</span>
                                {hasVoted && <span className="ml-auto text-xs font-bold">✓</span>}
                              </div>
                            )
                          })}
                        </div>

                        {/* Grille de vote pour l'hôte */}
                        {hostParticipating === true && !hostVote && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-400 mb-2">Votre vote :</p>
                            <div className="flex flex-wrap gap-1.5">
                              {scaleInfo.values.map((v) => (
                                <button
                                  key={v}
                                  onClick={() => {
                                    setHostVote(v)
                                    vote(activeTicket.id, v, hostName, room.scale)
                                  }}
                                  className="min-w-[36px] px-2 h-10 rounded-xl border-2 border-gray-200 bg-white text-sm font-bold text-gray-700 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition-all"
                                >
                                  {v}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {hostParticipating === true && hostVote && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                            <span>Votre vote : <strong>{hostVote}</strong></span>
                            <button onClick={() => { setHostVote(null); }} className="text-gray-400 hover:text-gray-600 underline">Changer</button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 justify-center mt-4">
                      <button
                        onClick={() => reveal(activeTicket.id, room.scale)}
                        disabled={totalVoted === 0}
                        className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
                      >
                        Révéler les votes
                      </button>
                    </div>
                  </>
                )
              })()}

              {/* REVEALED state */}
              {activeTicket.status === 'REVEALED' && (
                <>
                  {(() => {
                    const numericVotes = activeTicket.votes
                      .map((v) => parseFloat(v.value))
                      .filter((v) => !isNaN(v))
                    const avg = numericVotes.length > 0
                      ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
                      : null
                    const sorted = [...numericVotes].sort((a, b) => a - b)
                    const median = sorted.length > 0
                      ? sorted.length % 2 === 0
                        ? ((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(1)
                        : String(sorted[Math.floor(sorted.length / 2)])
                      : null
                    return (
                      <div className="flex gap-4 mb-4">
                        {avg && <div className="bg-blue-50 rounded-xl px-4 py-2 text-center"><p className="text-xs text-blue-500">Moyenne</p><p className="text-xl font-bold text-blue-700">{avg}{scaleInfo.suffix ? ` ${scaleInfo.suffix}` : ''}</p></div>}
                        {median && <div className="bg-secondary-50 rounded-xl px-4 py-2 text-center"><p className="text-xs text-secondary-500">Médiane</p><p className="text-xl font-bold text-secondary-700">{median}{scaleInfo.suffix ? ` ${scaleInfo.suffix}` : ''}</p></div>}
                      </div>
                    )
                  })()}

                  <div className="flex-1 flex flex-wrap gap-4 content-start overflow-y-auto">
                    {activeTicket.votes.map((vote) => (
                      <VoteCard key={vote.id} value={vote.value} name={vote.participantName} />
                    ))}
                  </div>

                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-medium text-gray-500 mb-3">Choisir l'estimation finale ({scaleInfo.label}) :</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {scaleInfo.values.map((v) => (
                        <button
                          key={v}
                          onClick={() => setSelectedEstimate(v === selectedEstimate ? null : v)}
                          className={`min-w-[40px] px-2 h-14 rounded-xl border-2 text-sm font-bold transition-all ${
                            selectedEstimate === v
                              ? 'border-primary-500 bg-primary-600 text-white shadow-md'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSetEstimate}
                        disabled={!selectedEstimate}
                        className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
                      >
                        Valider
                      </button>
                      <button
                        onClick={() => resetTicket(activeTicket.id, room.scale)}
                        className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Re-voter
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Batch estimate picker modal ── */}
      {showBatchPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Estimation directe</h2>
              <p className="text-sm text-gray-500 mt-1">
                Appliquer la même valeur ({scaleInfo.label}) aux {selectedTicketIds.size} tickets sélectionnés
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {scaleInfo.values.map((v) => (
                <button
                  key={v}
                  onClick={() => handleBatchEstimate(v)}
                  className="min-w-[44px] px-2 h-14 rounded-xl border-2 border-gray-200 bg-white text-sm font-bold text-gray-700 hover:border-primary-400 hover:bg-primary-50 hover:text-primary-700 transition-all"
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowBatchPicker(false)}
              className="text-sm text-gray-400 hover:text-gray-600 self-end"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
