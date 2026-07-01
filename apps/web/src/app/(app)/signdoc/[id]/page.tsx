'use client'

import { use, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, Plus, Trash2, Share2, Save, PenLine, Type, Calendar, Hash,
  GripVertical, Clock, ChevronUp, ChevronDown, Send, Ban, Check,
} from 'lucide-react'
import { PdfPageCanvas } from '@/components/pdf/pdf-page-canvas'
import { ModuleShareModal } from '@/components/share/module-share-modal'
import {
  useEnvelope, FILE_URL, verifyEnvelope, downloadSealed,
  type SignFieldType, type FieldInput, type SignRecipient, type SignEvent, type VerifyResult,
} from '@/hooks/useSigndoc'
import { Download, ShieldCheck, ShieldAlert } from 'lucide-react'

// Couleurs attribuées aux signataires (code couleur du designer).
const RECIPIENT_COLORS = ['#0d9488', '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#0ea5e9']

const FIELD_META: Record<SignFieldType, { label: string; icon: typeof PenLine }> = {
  SIGNATURE: { label: 'Signature', icon: PenLine },
  INITIALS:  { label: 'Paraphe',   icon: Hash },
  DATE:      { label: 'Date',      icon: Calendar },
  TEXT:      { label: 'Texte',     icon: Type },
}

const DND_FIELD = 'application/signdoc-field'
const PAGE_SCALE = 1.15
const DEFAULT_W = 0.22
const DEFAULT_H = 0.07

// Champ en cours d'édition côté client (cid = clé React + identité de drag).
interface LocalField extends FieldInput {
  cid: string
}

function cid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const RECIPIENT_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'En attente', cls: 'text-gray-400' },
  SENT:     { label: 'Envoyé',     cls: 'text-blue-500' },
  VIEWED:   { label: 'Consulté',   cls: 'text-amber-500' },
  SIGNED:   { label: 'Signé',      cls: 'text-green-600' },
  DECLINED: { label: 'Refusé',     cls: 'text-red-500' },
}

const EVENT_LABEL: Record<string, string> = {
  created: 'Enveloppe créée',
  sent: 'Envoyée',
  viewed: 'Consultée',
  signed: 'Signée',
  declined: 'Refusée',
  completed: 'Terminée',
  voided: 'Annulée',
}

// ── Page du designer : un PDF rendu + ses champs en overlay ──────────────────

function DesignerPage({
  envelopeId, pageIndex, fields, colorOf, canEdit, activeRecipientId,
  onAdd, onMove, onResize, onRemove,
}: {
  envelopeId: string
  pageIndex: number
  fields: LocalField[]
  colorOf: (recipientId: string) => string
  canEdit: boolean
  activeRecipientId: string | null
  onAdd: (page: number, type: SignFieldType, x: number, y: number) => void
  onMove: (cid: string, x: number, y: number) => void
  onResize: (cid: string, w: number, h: number) => void
  onRemove: (cid: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ cid: string; mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null)

  const rect = () => containerRef.current?.getBoundingClientRect()

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const d = drag.current
      const r = rect()
      if (!d || !r) return
      const dx = (e.clientX - d.sx) / r.width
      const dy = (e.clientY - d.sy) / r.height
      if (d.mode === 'move') {
        onMove(d.cid, Math.min(Math.max(d.ox + dx, 0), 1 - d.ow), Math.min(Math.max(d.oy + dy, 0), 1 - d.oh))
      } else {
        onResize(d.cid, Math.min(Math.max(d.ow + dx, 0.05), 1 - d.ox), Math.min(Math.max(d.oh + dy, 0.03), 1 - d.oy))
      }
    }
    function onPointerUp() { drag.current = null }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => { window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp) }
  }, [onMove, onResize])

  return (
    <div className="relative inline-block shadow-sm border border-gray-200 dark:border-gray-700" ref={containerRef}>
      <PdfPageCanvas docUrl={FILE_URL(envelopeId)} pageNumber={pageIndex + 1} scale={PAGE_SCALE} className="block" />
      <div
        className="absolute inset-0"
        onDragOver={(e) => { if (canEdit && activeRecipientId) e.preventDefault() }}
        onDrop={(e) => {
          if (!canEdit || !activeRecipientId) return
          const type = e.dataTransfer.getData(DND_FIELD) as SignFieldType
          if (!type) return
          e.preventDefault()
          const r = rect()
          if (!r) return
          const x = Math.min(Math.max((e.clientX - r.left) / r.width - DEFAULT_W / 2, 0), 1 - DEFAULT_W)
          const y = Math.min(Math.max((e.clientY - r.top) / r.height - DEFAULT_H / 2, 0), 1 - DEFAULT_H)
          onAdd(pageIndex, type, x, y)
        }}
      >
        {fields.map((f) => {
          const color = colorOf(f.recipientId)
          const Icon = FIELD_META[f.type].icon
          return (
            <div
              key={f.cid}
              className="absolute rounded-md border-2 flex items-center justify-center text-[10px] font-medium select-none group"
              style={{
                left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%`,
                borderColor: color, background: `${color}22`, color,
                cursor: canEdit ? 'move' : 'default',
              }}
              onPointerDown={(e) => {
                if (!canEdit) return
                e.preventDefault()
                drag.current = { cid: f.cid, mode: 'move', sx: e.clientX, sy: e.clientY, ox: f.x, oy: f.y, ow: f.w, oh: f.h }
              }}
            >
              <Icon size={12} className="mr-1 shrink-0" />
              <span className="truncate">{FIELD_META[f.type].label}</span>
              {canEdit && (
                <>
                  <button
                    onPointerDown={(e) => { e.stopPropagation() }}
                    onClick={(e) => { e.stopPropagation(); onRemove(f.cid) }}
                    className="absolute -top-2 -right-2 bg-white dark:bg-gray-800 rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 text-red-500"
                  >
                    <Trash2 size={10} />
                  </button>
                  <span
                    onPointerDown={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      drag.current = { cid: f.cid, mode: 'resize', sx: e.clientX, sy: e.clientY, ox: f.x, oy: f.y, ow: f.w, oh: f.h }
                    }}
                    className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
                    style={{ background: color, opacity: 0.6 }}
                  />
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Panneau signataires ──────────────────────────────────────────────────────

function RecipientsPanel({
  recipients, ordered, colorOf, canEdit, activeRecipientId, onSetActive,
  onToggleOrdered, onAdd, onRemove, onReorder,
}: {
  recipients: SignRecipient[]
  ordered: boolean
  colorOf: (id: string) => string
  canEdit: boolean
  activeRecipientId: string | null
  onSetActive: (id: string) => void
  onToggleOrdered: (v: boolean) => void
  onAdd: (email: string, name: string) => Promise<void>
  onRemove: (id: string) => void
  onReorder: (id: string, dir: -1 | 1) => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setAdding(true)
    try { await onAdd(email.trim(), name.trim()); setEmail(''); setName('') }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Erreur') }
    finally { setAdding(false) }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Signataires</h3>
        {canEdit && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input type="checkbox" checked={ordered} onChange={(e) => onToggleOrdered(e.target.checked)} className="rounded" />
            Ordre séquentiel
          </label>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {recipients.length === 0 && <p className="text-xs text-gray-400">Aucun signataire pour l&apos;instant.</p>}
        {recipients.map((r, i) => (
          <div
            key={r.id}
            onClick={() => onSetActive(r.id)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer border ${activeRecipientId === r.id ? 'border-teal-400 bg-teal-50/50 dark:bg-teal-950/20' : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colorOf(r.id) }} />
            {ordered && <span className="text-[10px] font-semibold text-gray-400 w-4 text-center">{r.routingOrder}</span>}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{r.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{r.email}{r.userId ? '' : ' · externe'}</p>
            </div>
            {!canEdit && (
              <span className={`text-[10px] font-medium shrink-0 ${RECIPIENT_STATUS[r.status]?.cls ?? 'text-gray-400'}`}>{RECIPIENT_STATUS[r.status]?.label ?? r.status}</span>
            )}
            {canEdit && ordered && (
              <div className="flex flex-col">
                <button onClick={(e) => { e.stopPropagation(); onReorder(r.id, -1) }} disabled={i === 0} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronUp size={11} /></button>
                <button onClick={(e) => { e.stopPropagation(); onReorder(r.id, 1) }} disabled={i === recipients.length - 1} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ChevronDown size={11} /></button>
              </div>
            )}
            {canEdit && (
              <button onClick={(e) => { e.stopPropagation(); onRemove(r.id) }} className="text-gray-300 hover:text-red-500 shrink-0"><Trash2 size={12} /></button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={submit} className="flex flex-col gap-1.5 border-t border-gray-100 dark:border-gray-800 pt-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du signataire" className="text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" className="text-xs border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5" />
          {err && <p className="text-[10px] text-red-500">{err}</p>}
          <button type="submit" disabled={adding || !email.trim() || !name.trim()} className="flex items-center justify-center gap-1 text-xs bg-teal-600 text-white rounded-lg px-2 py-1.5 hover:bg-teal-700 disabled:opacity-50">
            <Plus size={13} /> Ajouter
          </button>
        </form>
      )}
    </div>
  )
}

// ── Panneau de finalisation (enveloppe signée) ───────────────────────────────

function CompletionPanel({ envelopeId, envelopeName }: { envelopeId: string; envelopeName: string }) {
  const [verify, setVerify] = useState<VerifyResult | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => { verifyEnvelope(envelopeId).then(setVerify).catch(() => {}) }, [envelopeId])

  const ok = verify && verify.chainValid && verify.fileIntegrity !== false
  return (
    <div className="flex flex-col gap-3 border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-1.5">
        {ok ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />} Document signé & scellé
      </h3>
      <button
        onClick={async () => { setDownloading(true); try { await downloadSealed(envelopeId, envelopeName) } finally { setDownloading(false) } }}
        disabled={downloading}
        className="flex items-center justify-center gap-1.5 text-sm bg-teal-600 text-white rounded-lg px-3 py-2 hover:bg-teal-700 disabled:opacity-50"
      >
        {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Télécharger le document signé
      </button>
      {verify && (
        <div className="text-[11px] text-gray-600 dark:text-gray-300 flex flex-col gap-1">
          <Check2 label="Chaîne de preuve intègre" ok={verify.chainValid} />
          <Check2 label="Fichier scellé non modifié" ok={verify.fileIntegrity !== false} />
          <p className="text-gray-400">Sceau : {verify.sealLevel === 'B' ? 'PAdES-B (clé serveur)' : verify.sealLevel === 'T' ? 'PAdES-T (horodaté)' : 'aplati (non scellé)'}</p>
        </div>
      )}
    </div>
  )
}

function Check2({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 ${ok ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
      {ok ? <Check size={12} /> : <Ban size={12} />} {label}
    </span>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function EnvelopeWorkshopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { envelope, loading, error, patch, addRecipient, updateRecipient, removeRecipient, saveFields, send, voidEnvelope } = useEnvelope(id)

  const [localFields, setLocalFields] = useState<LocalField[]>([])
  const [dirty, setDirty] = useState(false)
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // (Ré)initialise les champs locaux quand l'enveloppe (re)charge.
  useEffect(() => {
    if (!envelope) return
    setLocalFields(envelope.fields.map((f) => ({ cid: cid(), recipientId: f.recipientId, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h, type: f.type, required: f.required })))
    setDirty(false)
    setActiveRecipientId((prev) => prev ?? envelope.recipients[0]?.id ?? null)
  }, [envelope])

  const colorOf = useCallback(
    (recipientId: string) => {
      const idx = envelope?.recipients.findIndex((r) => r.id === recipientId) ?? -1
      return RECIPIENT_COLORS[idx >= 0 ? idx % RECIPIENT_COLORS.length : 0]
    },
    [envelope],
  )

  if (loading) return <div className="flex justify-center py-20 text-gray-400"><Loader2 className="animate-spin" size={28} /></div>
  if (error || !envelope) return <div className="text-center py-20 text-red-500 text-sm">{error ?? 'Enveloppe introuvable.'}</div>

  const canEdit = (envelope.role === 'OWNER' || envelope.role === 'EDITOR') && envelope.status === 'DRAFT'

  function addField(page: number, type: SignFieldType, x: number, y: number) {
    if (!activeRecipientId) return
    setLocalFields((prev) => [...prev, { cid: cid(), recipientId: activeRecipientId, page, x, y, w: DEFAULT_W, h: DEFAULT_H, type, required: true }])
    setDirty(true)
  }
  function moveField(c: string, x: number, y: number) { setLocalFields((prev) => prev.map((f) => (f.cid === c ? { ...f, x, y } : f))); setDirty(true) }
  function resizeField(c: string, w: number, h: number) { setLocalFields((prev) => prev.map((f) => (f.cid === c ? { ...f, w, h } : f))); setDirty(true) }
  function removeField(c: string) { setLocalFields((prev) => prev.filter((f) => f.cid !== c)); setDirty(true) }

  async function persistFields() {
    setSaving(true)
    try { await saveFields(localFields.map(({ cid: _cid, ...f }) => f)); setDirty(false) }
    finally { setSaving(false) }
  }

  async function handleSend() {
    setSendError(null); setSending(true)
    try {
      if (dirty) await saveFields(localFields.map(({ cid: _cid, ...f }) => f))
      await send()
      setDirty(false)
    } catch (e) { setSendError(e instanceof Error ? e.message : 'Erreur') }
    finally { setSending(false) }
  }

  async function handleVoid() {
    const reason = window.prompt('Motif de l’annulation (facultatif) ?')
    if (reason === null) return
    await voidEnvelope(reason || undefined)
  }

  const canSend = canEdit && envelope.recipients.length > 0
  const isActive = envelope.status === 'SENT' || envelope.status === 'IN_PROGRESS'

  async function reorderRecipient(rid: string, dir: -1 | 1) {
    const r = envelope!.recipients.find((x) => x.id === rid)
    if (!r) return
    await updateRecipient(rid, { routingOrder: Math.max(1, r.routingOrder + dir) })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/signdoc" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ArrowLeft size={18} /></Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{envelope.name}</h1>
            <p className="text-xs text-gray-400">{envelope.pageCount} page{envelope.pageCount !== 1 ? 's' : ''} · {envelope.status === 'DRAFT' ? 'Brouillon' : envelope.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dirty && canEdit && (
            <button onClick={persistFields} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Enregistrer
            </button>
          )}
          {envelope.role === 'OWNER' && (
            <button onClick={() => setSharing(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Share2 size={15} /> Partager
            </button>
          )}
          {isActive && envelope.role === 'OWNER' && (
            <button onClick={handleVoid} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 dark:border-red-900 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
              <Ban size={15} /> Annuler
            </button>
          )}
          {canSend && (
            <button onClick={handleSend} disabled={sending} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Envoyer
            </button>
          )}
        </div>
      </div>
      {sendError && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-xl px-4 py-2">{sendError}</div>}

      {!canEdit && envelope.status === 'DRAFT' && (
        <div className="text-xs bg-gray-50 dark:bg-gray-800/50 text-gray-500 rounded-xl px-4 py-2">Accès en lecture seule.</div>
      )}

      <div className="flex gap-5">
        {/* Designer (pages) */}
        <div className="flex-1 min-w-0 flex flex-col items-center gap-5 overflow-auto">
          {Array.from({ length: envelope.pageCount }, (_, p) => (
            <DesignerPage
              key={p}
              envelopeId={envelope.id}
              pageIndex={p}
              fields={localFields.filter((f) => f.page === p)}
              colorOf={colorOf}
              canEdit={canEdit}
              activeRecipientId={activeRecipientId}
              onAdd={addField}
              onMove={moveField}
              onResize={resizeField}
              onRemove={removeField}
            />
          ))}
        </div>

        {/* Panneau latéral */}
        <aside className="w-72 shrink-0 flex flex-col gap-5">
          {envelope.status === 'COMPLETED' && <CompletionPanel envelopeId={envelope.id} envelopeName={envelope.name} />}
          <RecipientsPanel
            recipients={envelope.recipients}
            ordered={envelope.ordered}
            colorOf={colorOf}
            canEdit={canEdit}
            activeRecipientId={activeRecipientId}
            onSetActive={setActiveRecipientId}
            onToggleOrdered={(v) => patch({ ordered: v })}
            onAdd={async (email, name) => { const r = await addRecipient({ email, name }); setActiveRecipientId(r.id) }}
            onRemove={(rid) => { removeRecipient(rid); setLocalFields((prev) => prev.filter((f) => f.recipientId !== rid)); setDirty(true) }}
            onReorder={reorderRecipient}
          />

          {/* Palette de champs */}
          {canEdit && (
            <div className="flex flex-col gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Champs à placer</h3>
              {!activeRecipientId ? (
                <p className="text-xs text-gray-400">Ajoutez un signataire pour placer des champs.</p>
              ) : (
                <>
                  <p className="text-[11px] text-gray-400">Glissez un champ sur le document pour <span className="font-medium" style={{ color: colorOf(activeRecipientId) }}>{envelope.recipients.find((r) => r.id === activeRecipientId)?.name}</span>.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(FIELD_META) as SignFieldType[]).map((t) => {
                      const M = FIELD_META[t]
                      return (
                        <div
                          key={t}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData(DND_FIELD, t) }}
                          className="flex items-center gap-1.5 px-2 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 cursor-grab active:cursor-grabbing hover:border-teal-300"
                        >
                          <GripVertical size={12} className="text-gray-300" />
                          <M.icon size={13} /> {M.label}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Timeline */}
          <div className="flex flex-col gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5"><Clock size={14} /> Historique</h3>
            <div className="flex flex-col gap-2">
              {envelope.events.map((ev: SignEvent) => (
                <div key={ev.id} className="flex items-start gap-2 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-gray-700 dark:text-gray-200">{EVENT_LABEL[ev.type] ?? ev.type}</p>
                    <p className="text-[10px] text-gray-400">{ev.actorLabel} · {fmtDate(ev.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {sharing && <ModuleShareModal module="signdoc" resourceId={envelope.id} resourceName={envelope.name} onClose={() => setSharing(false)} />}
    </div>
  )
}
