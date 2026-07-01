'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, PenLine, Check, X, ShieldCheck, CalendarDays } from 'lucide-react'
import { PdfPageCanvas } from '@/components/pdf/pdf-page-canvas'
import { SignaturePad } from '@/components/signdoc/signature-pad'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

type FieldType = 'SIGNATURE' | 'INITIALS' | 'DATE' | 'TEXT'

interface PubField { id: string; page: number; x: number; y: number; w: number; h: number; type: FieldType; required: boolean }
interface SignView {
  envelope: { id: string; name: string; message: string | null; pageCount: number; status: string; ordered: boolean }
  recipient: { id: string; name: string; email: string; status: string; role: string }
  fields: PubField[]
  yourTurn: boolean
}

const PAGE_SCALE = 1.2

function todayStr() {
  return new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [view, setView] = useState<SignView | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})
  const [padField, setPadField] = useState<PubField | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'signed' | 'declined' | null>(null)
  const [declining, setDeclining] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/api/sign/${token}`)
      .then(async (r) => { if (!r.ok) throw new Error('not found'); return r.json() as Promise<SignView> })
      .then((v) => {
        if (cancelled) return
        setView(v)
        // Pré-remplit les champs Date avec la date du jour.
        const init: Record<string, string> = {}
        for (const f of v.fields) if (f.type === 'DATE') init[f.id] = todayStr()
        setValues(init)
      })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  const requiredFilled = useMemo(() => {
    if (!view) return false
    return view.fields.filter((f) => f.required).every((f) => values[f.id]?.trim())
  }, [view, values])

  const submit = useCallback(async () => {
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(`${API_URL}/api/sign/${token}/sign`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: Object.entries(values).map(([id, value]) => ({ id, value })) }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? 'Erreur') }
      setDone('signed')
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
    finally { setSubmitting(false) }
  }, [token, values])

  async function decline() {
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(`${API_URL}/api/sign/${token}/decline`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason.trim() || undefined }),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? 'Erreur') }
      setDone('declined')
    } catch (e) { setError(e instanceof Error ? e.message : 'Erreur') }
    finally { setSubmitting(false); setDeclining(false) }
  }

  if (loading) return <Centered><Loader2 className="animate-spin text-teal-600" size={32} /></Centered>
  if (notFound) return <Message icon="❌" title="Lien invalide ou expiré" text="Ce lien de signature n’est plus valable. Contactez l’expéditeur du document." />
  if (!view) return null

  if (done === 'signed') return <Message icon="✅" title="Document signé" text="Merci ! Votre signature a bien été enregistrée. Vous pouvez fermer cette page." />
  if (done === 'declined') return <Message icon="🚫" title="Signature refusée" text="Vous avez refusé de signer ce document. L’expéditeur en a été informé." />

  const isCc = view.recipient.role === 'CC'

  if (view.recipient.status === 'SIGNED') return <Message icon="✅" title="Déjà signé" text="Vous avez déjà signé ce document." />
  if (view.envelope.status === 'COMPLETED') {
    if (isCc) {
      return (
        <Centered>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 max-w-sm text-center mx-4">
            <div className="text-4xl mb-3">✅</div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Document finalisé</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">« {view.envelope.name} » est entièrement signé. Vous le recevez en copie.</p>
            <a href={`${API_URL}/api/sign/${token}/sealed`} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700">
              <ShieldCheck size={15} /> Télécharger le document signé
            </a>
          </div>
        </Centered>
      )
    }
    return <Message icon="✅" title="Document finalisé" text="Ce document est entièrement signé." />
  }
  if (view.envelope.status === 'VOIDED' || view.envelope.status === 'DECLINED' || view.envelope.status === 'EXPIRED')
    return <Message icon="⌛" title="Demande clôturée" text="Cette demande de signature n’est plus active." />
  if (!view.yourTurn && !isCc) return <Message icon="⏳" title="En attente" text="Ce n’est pas encore votre tour de signer. Vous serez notifié·e le moment venu." />

  const fileUrl = `${API_URL}/api/sign/${token}/file`

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      {/* Barre d'action */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <PenLine className="text-teal-600 shrink-0" size={20} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{view.envelope.name}</p>
              <p className="text-[11px] text-gray-400">{isCc ? 'En copie' : 'Signataire'} : {view.recipient.name}</p>
            </div>
          </div>
          {!isCc && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setDeclining(true)} className="px-3 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">Refuser</button>
              <button onClick={submit} disabled={!requiredFilled || submitting} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Terminer
              </button>
            </div>
          )}
        </div>
      </header>

      {isCc && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="text-sm bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 rounded-xl px-4 py-3">
            Vous recevez ce document en copie pour information : un parcours de signature est en cours. Aucune action n’est attendue de votre part.
          </div>
        </div>
      )}

      {view.envelope.message && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="text-sm bg-teal-50 dark:bg-teal-950/20 text-teal-800 dark:text-teal-200 rounded-xl px-4 py-3">{view.envelope.message}</div>
        </div>
      )}

      {!requiredFilled && (
        <div className="max-w-5xl mx-auto px-4 pt-3 text-xs text-gray-500 flex items-center gap-1.5">
          <ShieldCheck size={13} /> Cliquez sur les zones surlignées pour remplir tous les champs requis.
        </div>
      )}

      {/* Document */}
      <main className="max-w-5xl mx-auto px-4 py-5 flex flex-col items-center gap-5">
        {Array.from({ length: view.envelope.pageCount }, (_, p) => (
          <div key={p} className="relative inline-block shadow border border-gray-200 dark:border-gray-700">
            <PdfPageCanvas docUrl={fileUrl} pageNumber={p + 1} scale={PAGE_SCALE} className="block" />
            <div className="absolute inset-0">
              {view.fields.filter((f) => f.page === p).map((f) => {
                const val = values[f.id]
                const style = { left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }
                if (f.type === 'TEXT') {
                  return (
                    <input
                      key={f.id} value={val ?? ''} placeholder="Texte"
                      onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                      className="absolute text-xs px-1 rounded border-2 border-teal-400 bg-white/90 dark:bg-gray-800/90 outline-none"
                      style={style}
                    />
                  )
                }
                if (f.type === 'DATE') {
                  return (
                    <div key={f.id} className="absolute rounded border-2 border-teal-400 bg-white/90 dark:bg-gray-800/90 flex items-center justify-center text-xs gap-1" style={style}>
                      <CalendarDays size={11} /> {val}
                    </div>
                  )
                }
                // SIGNATURE / INITIALS
                return (
                  <button
                    key={f.id} onClick={() => setPadField(f)}
                    className="absolute rounded border-2 flex items-center justify-center overflow-hidden"
                    style={{ ...style, borderColor: val ? '#0d9488' : '#f59e0b', background: val ? 'transparent' : 'rgba(245,158,11,0.15)' }}
                  >
                    {val ? <img src={val} alt="" className="w-full h-full object-contain" /> : <span className="text-[10px] font-medium text-amber-600">{f.type === 'INITIALS' ? 'Paraphe' : 'Signer'}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </main>

      {error && <p className="text-center text-sm text-red-500 pb-4">{error}</p>}

      {padField && (
        <SignaturePad
          label={padField.type === 'INITIALS' ? 'Paraphe' : 'Signature'}
          onConfirm={(dataUrl) => { setValues((v) => ({ ...v, [padField.id]: dataUrl })); setPadField(null) }}
          onClose={() => setPadField(null)}
        />
      )}

      {declining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDeclining(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-xl w-full max-w-sm flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold text-gray-900 dark:text-white">Refuser de signer</h3><button onClick={() => setDeclining(false)}><X size={16} className="text-gray-400" /></button></div>
            <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} placeholder="Motif (facultatif)" rows={3} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeclining(false)} className="px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">Annuler</button>
              <button onClick={decline} disabled={submitting} className="px-4 py-2 rounded-xl text-sm bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50">Confirmer le refus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950">{children}</div>
}

function Message({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <Centered>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 max-w-sm text-center mx-4">
        <div className="text-4xl mb-3">{icon}</div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{title}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{text}</p>
      </div>
    </Centered>
  )
}
