'use client'

import { useState } from 'react'
import { Send, RefreshCw, Trash2, Copy, Check, Users, Settings2 } from 'lucide-react'
import { useFormRecipients } from '@/hooks/useForms'
import type { FormRecipientEntry } from '@pouetpouet/shared'

function parseRecipients(text: string): { name: string; email: string }[] {
  const out: { name: string; email: string }[] = []
  const seen = new Set<string>()
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^(.*?)<([^<>]+)>$/)
    const email = (m ? m[2] : line).trim().toLowerCase()
    const name = (m ? m[1] : line).trim()
    if (!/^\S+@\S+\.\S+$/.test(email) || seen.has(email)) continue
    seen.add(email)
    out.push({ name: name || email, email })
  }
  return out
}

function StatusBadge({ r }: { r: FormRecipientEntry }) {
  if (r.respondedAt) return <span className="px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-medium">Répondu</span>
  if (r.invitedAt) return <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-xs font-medium">En attente</span>
  return <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-medium">Non envoyé</span>
}

interface Props {
  formId: string
  remindersEnabled: boolean
  reminderFrequencyDays: number
  onUpdateReminders: (patch: { remindersEnabled?: boolean; reminderFrequencyDays?: number }) => void
}

export function FormRecipientsPanel({ formId, remindersEnabled, reminderFrequencyDays, onUpdateReminders }: Props) {
  const { recipients, isLoading, addRecipients, removeRecipient, sendInvites, remind } = useFormRecipients(formId)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const parsed = parseRecipients(pasteText)

  async function handleAdd() {
    if (parsed.length === 0) return
    setAdding(true)
    try {
      await addRecipients(parsed)
      setPasteText('')
      setPasteOpen(false)
    } finally { setAdding(false) }
  }

  async function handleSendAll() {
    setBusyId('__send_all__')
    try { await sendInvites() } finally { setBusyId(null) }
  }

  async function handleSendOne(rid: string) {
    setBusyId(rid)
    try { await sendInvites([rid]) } finally { setBusyId(null) }
  }

  async function handleRemind(rid: string) {
    setBusyId(rid)
    try {
      await remind(rid)
    } catch {
      alert('Impossible de relancer maintenant (une relance a déjà été envoyée récemment).')
    } finally {
      setBusyId(null)
    }
  }

  function copyLink(r: FormRecipientEntry) {
    const link = `${window.location.origin}/f/${r.token}`
    navigator.clipboard.writeText(link)
    setCopiedId(r.id)
    setTimeout(() => setCopiedId((c) => (c === r.id ? null : c)), 1500)
  }

  const pendingCount = recipients.filter((r) => !r.invitedAt).length

  if (isLoading) return (
    <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
          <Settings2 className="w-4 h-4" /> Relances automatiques
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={remindersEnabled}
              onChange={(e) => onUpdateReminders({ remindersEnabled: e.target.checked })}
              className="w-4 h-4 rounded accent-violet-500"
            />
            Activer les relances automatiques
          </label>
          {remindersEnabled && (
            <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              Tous les
              <input
                type="number"
                min={1}
                max={30}
                value={reminderFrequencyDays}
                onChange={(e) => onUpdateReminders({ reminderFrequencyDays: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })}
                className="w-16 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent text-center"
              />
              jours, aux non-répondants
            </label>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold dark:text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-400" /> Destinataires <span className="text-gray-400 font-normal">({recipients.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button
              onClick={handleSendAll}
              disabled={busyId === '__send_all__'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              <Send className="w-4 h-4" /> Envoyer à {pendingCount} non-invité{pendingCount > 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={() => setPasteOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            + Ajouter des destinataires
          </button>
        </div>
      </div>

      {pasteOpen && (
        <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col gap-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Une ligne par destinataire : Nom <email@exemple.fr>\nou juste l'email"}
            rows={5}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-transparent text-sm resize-y"
          />
          <div className="flex items-center gap-2 self-end">
            <button onClick={() => setPasteOpen(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Annuler</button>
            <button
              onClick={handleAdd}
              disabled={adding || parsed.length === 0}
              className="px-4 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {adding ? 'Ajout…' : `Ajouter (${parsed.length})`}
            </button>
          </div>
        </div>
      )}

      {recipients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Users className="w-10 h-10 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">Aucun destinataire pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-300">Nom</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-300">Email</th>
                <th className="px-4 py-3 font-medium text-gray-400">Statut</th>
                <th className="px-4 py-3 font-medium text-gray-400">Relances</th>
                <th className="px-4 py-3 w-40" />
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3 dark:text-gray-200">{r.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.email}</td>
                  <td className="px-4 py-3"><StatusBadge r={r} /></td>
                  <td className="px-4 py-3 text-gray-400">{r.remindersSent || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => copyLink(r)} title="Copier le lien" className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                        {copiedId === r.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      {!r.invitedAt ? (
                        <button onClick={() => handleSendOne(r.id)} disabled={busyId === r.id} title="Envoyer" className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 disabled:opacity-40 transition-colors">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      ) : !r.respondedAt ? (
                        <button onClick={() => handleRemind(r.id)} disabled={busyId === r.id} title="Relancer" className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 disabled:opacity-40 transition-colors">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      ) : null}
                      <button onClick={() => removeRecipient(r.id)} title="Supprimer" className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
