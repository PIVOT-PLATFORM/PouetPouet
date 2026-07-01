'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Eye, Link2, Check, BarChart3, Users, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { useForm } from '@/hooks/useForms'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { FormFieldBuilder } from '@/components/forms/FormFieldBuilder'
import { FormFieldInput } from '@/components/forms/FormFieldInput'
import { ModuleShareModal } from '@/components/share/module-share-modal'
import type { FormFieldDef } from '@pouetpouet/shared'

function newId() {
  return `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}
function makeField(): FormFieldDef {
  return { id: newId(), label: '', type: 'short_text', required: false }
}
function makeSection(): FormFieldDef {
  return { id: newId(), label: '', type: 'section', required: false }
}

// ISO (UTC) → valeur d'un input datetime-local (heure locale, sans secondes).
function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function FormEditPage() {
  useFlagGuard('module.forms')
  const { id } = useParams<{ id: string }>()
  const { form, isLoading, accessDenied, updateForm } = useForm(id)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<FormFieldDef[]>([])
  const [confirmationMessage, setConfirmationMessage] = useState('')
  const [redirectUrl, setRedirectUrl] = useState('')
  const [closesAt, setClosesAt] = useState('')
  const [maxResponses, setMaxResponses] = useState('')
  const [preview, setPreview] = useState(false)
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({})
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [copied, setCopied] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const hydrated = useRef(false)

  useEffect(() => {
    if (form && !hydrated.current) {
      setTitle(form.title)
      setDescription(form.description ?? '')
      setFields(form.fields)
      setConfirmationMessage(form.confirmationMessage ?? '')
      setRedirectUrl(form.redirectUrl ?? '')
      setClosesAt(isoToLocalInput(form.closesAt))
      setMaxResponses(form.maxResponses != null ? String(form.maxResponses) : '')
      hydrated.current = true
    }
  }, [form])

  // Sauvegarde auto (debounce) dès qu'un champ change
  const save = useCallback(async (patch: Parameters<typeof updateForm>[0]) => {
    setSaveState('saving')
    try {
      await updateForm(patch)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1500)
    } catch {
      setSaveState('idle')
    }
  }, [updateForm])

  useEffect(() => {
    if (!hydrated.current) return
    const t = setTimeout(() => {
      save({
        title: title || 'Sans titre',
        description: description || null,
        fields,
        confirmationMessage: confirmationMessage || null,
        redirectUrl: redirectUrl || null,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
        maxResponses: maxResponses ? Number(maxResponses) : null,
      })
    }, 800)
    return () => clearTimeout(t)
  }, [title, description, fields, confirmationMessage, redirectUrl, closesAt, maxResponses, save])

  if (isLoading) return (
    <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
  )
  if (accessDenied || !form) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-gray-500 dark:text-gray-400">Formulaire introuvable ou accès refusé.</p>
      <Link href="/forms" className="text-violet-500 hover:underline text-sm">← Mes formulaires</Link>
    </div>
  )

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/f/${form.publicToken}` : ''
  const sectionList = fields.filter((f) => f.type === 'section').map((f) => ({ id: f.id, label: f.label }))

  function updateField(idx: number, patch: Partial<FormFieldDef>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  }
  function reorderField(from: number, to: number) {
    setFields((prev) => {
      if (to < 0 || to >= prev.length || from === to) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
  }
  function moveField(idx: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev]
      const target = idx + dir
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  async function togglePublish() {
    await save({ isPublished: !form!.isPublished })
  }
  async function toggleAccepting() {
    await save({ acceptingResponses: !form!.acceptingResponses })
  }
  async function toggleLimit() {
    await save({ limitOneResponse: !form!.limitOneResponse })
  }
  async function toggleNotify() {
    await save({ notifyOnResponse: !form!.notifyOnResponse })
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between gap-4">
        <Link href="/forms" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">← Formulaires</Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 min-w-[80px] text-right">
            {saveState === 'saving' ? 'Enregistrement…' : saveState === 'saved' ? 'Enregistré ✓' : ''}
          </span>
          <button
            onClick={() => setPreview((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white transition-colors"
          >
            <Eye className="w-4 h-4" /> {preview ? 'Éditer' : 'Aperçu'}
          </button>
          <Link
            href={`/forms/${id}/responses`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white transition-colors"
          >
            <BarChart3 className="w-4 h-4" /> Réponses
          </Link>
          {form.role === 'OWNER' && (
            <button
              onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white transition-colors"
            >
              <Users className="w-4 h-4" /> Partager
            </button>
          )}
        </div>
      </div>

      {/* Bloc réglages — collapsible */}
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {/* Header cliquable */}
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Settings2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Réglages du formulaire</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Badges de statut visibles même fermé */}
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${form.isPublished ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
              {form.isPublished ? 'Publié' : 'Brouillon'}
            </span>
            {!form.acceptingResponses && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400">Fermé</span>
            )}
            {settingsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </button>

        {settingsOpen && (
          <div className="flex flex-col gap-3 px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
            <div className="flex flex-wrap gap-x-5 gap-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-white">
                <input type="checkbox" checked={form.acceptingResponses} onChange={toggleAccepting} className="w-4 h-4 rounded text-violet-500" />
                Accepte les réponses
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-white" title="Empêche une même personne de répondre plusieurs fois (basé sur le navigateur).">
                <input type="checkbox" checked={form.limitOneResponse} onChange={toggleLimit} className="w-4 h-4 rounded text-violet-500" />
                Une réponse par personne
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm dark:text-white" title="Recevoir un email à chaque nouvelle réponse.">
                <input type="checkbox" checked={form.notifyOnResponse} onChange={toggleNotify} className="w-4 h-4 rounded text-violet-500" />
                M'avertir par email à chaque réponse
              </label>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Après envoi</span>
              <textarea
                value={confirmationMessage}
                onChange={(e) => setConfirmationMessage(e.target.value)}
                rows={2}
                placeholder="Message de remerciement (défaut : « Votre réponse a bien été enregistrée. »)"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
              />
              <input
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="URL de redirection après envoi (optionnel, ex. https://…)"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Fermeture automatique</span>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2 dark:text-gray-300">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Date limite</span>
                  <input
                    type="datetime-local"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none"
                  />
                  {closesAt && <button onClick={() => setClosesAt('')} className="text-xs text-gray-400 hover:text-red-500">effacer</button>}
                </label>
                <label className="flex items-center gap-2 dark:text-gray-300">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Max réponses</span>
                  <input
                    type="number" min={1} value={maxResponses}
                    onChange={(e) => setMaxResponses(e.target.value)}
                    placeholder="∞"
                    className="w-24 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {preview ? (
        /* ── Aperçu ── */
        <div className="flex flex-col gap-5 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">{title || 'Sans titre'}</h2>
            {description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-wrap">{description}</p>}
          </div>
          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Aucun champ.</p>
          ) : fields.map((f) => (
            <FormFieldInput key={f.id} field={f} value={previewData[f.id]} onChange={(v) => setPreviewData((p) => ({ ...p, [f.id]: v }))} />
          ))}
        </div>
      ) : (
        /* ── Édition ── */
        <>
          <div className="flex flex-col gap-3 p-5 rounded-2xl border-t-4 border-violet-500 border-x border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre du formulaire"
              className="text-2xl font-bold bg-transparent focus:outline-none dark:text-white placeholder:text-gray-300"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optionnel)"
              rows={2}
              className="text-sm bg-transparent focus:outline-none text-gray-600 dark:text-gray-300 placeholder:text-gray-300 resize-none"
            />
          </div>

          {fields.map((f, idx) => (
            <div
              key={f.id}
              draggable={dragIndex === idx}
              onDragEnd={() => setDragIndex(null)}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragIndex !== null && dragIndex !== idx) { reorderField(dragIndex, idx); setDragIndex(idx) }
              }}
              className={dragIndex === idx ? 'opacity-50' : ''}
            >
              <FormFieldBuilder
                field={f}
                index={idx}
                total={fields.length}
                sections={sectionList}
                dragHandleProps={{ onMouseDown: () => setDragIndex(idx) }}
                onChange={(patch) => updateField(idx, patch)}
                onDelete={() => setFields((prev) => prev.filter((_, i) => i !== idx))}
                onMove={(dir) => moveField(idx, dir)}
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={() => setFields((prev) => [...prev, makeField()])}
              className="flex-1 flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 text-sm text-gray-500 dark:text-gray-400 justify-center transition-colors"
            >
              <Plus className="w-4 h-4" /> Ajouter un champ
            </button>
            <button
              onClick={() => setFields((prev) => [...prev, makeSection()])}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-700 text-sm text-gray-500 dark:text-gray-400 justify-center transition-colors"
            >
              <Plus className="w-4 h-4" /> Section
            </button>
          </div>

          {/* Bouton de publication */}
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col gap-3">
            {form.isPublished ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Formulaire publié</p>
                    <p className="text-xs text-gray-400 mt-0.5">Partagez ce lien pour collecter des réponses.</p>
                  </div>
                  <button
                    onClick={togglePublish}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2 transition-colors"
                  >
                    Dépublier
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input readOnly value={shareUrl} className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 focus:outline-none" />
                  <button onClick={copyLink} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors">
                    {copied ? <><Check className="w-4 h-4" /> Copié !</> : <><Link2 className="w-4 h-4" /> Copier le lien</>}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium dark:text-white">Prêt à partager ?</p>
                  <p className="text-xs text-gray-400 mt-0.5">Publiez le formulaire pour générer un lien de partage.</p>
                </div>
                <button
                  onClick={togglePublish}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold transition-colors shadow-sm shadow-violet-200 dark:shadow-none"
                >
                  Publier
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {showShare && (
        <ModuleShareModal module="form" resourceId={id} resourceName={form.title} onClose={() => setShowShare(false)} />
      )}
    </div>
  )
}
