'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Loader2, CheckCircle2, XCircle, ExternalLink, AlertCircle } from 'lucide-react'
import { PIVOT_MODULES } from '@pouetpouet/shared'
import type { StepDef, ParcourDocClass, FormFieldDef, PublicForm } from '@pouetpouet/shared'
import { FormFieldInput } from '@/components/forms/FormFieldInput'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function fieldError(f: FormFieldDef, v: unknown): string | null {
  const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
  if (empty) return f.required ? 'Ce champ est requis' : null
  if (f.type === 'number') {
    const n = Number(v)
    if (Number.isNaN(n)) return 'Nombre invalide'
    if (f.min != null && n < f.min) return `Doit être ≥ ${f.min}`
    if (f.max != null && n > f.max) return `Doit être ≤ ${f.max}`
  }
  if ((f.type === 'short_text' || f.type === 'long_text') && typeof v === 'string' && f.maxLength != null && v.length > f.maxLength) {
    return `Maximum ${f.maxLength} caractères`
  }
  if (f.type === 'grid' && f.required) {
    const ans = (v ?? {}) as Record<string, unknown>
    for (const row of f.gridRows ?? []) {
      const rv = ans[row]
      if (rv == null || rv === '' || (Array.isArray(rv) && rv.length === 0)) return 'Répondez à toutes les lignes'
    }
  }
  return null
}

interface LinkedFormRendererProps {
  formId: string
  publicToken: string
  comment: string
  submitting: boolean
  setSubmitting: (v: boolean) => void
  onComplete: (data: Record<string, unknown>, comment: string) => Promise<void>
}

type LoadError =
  | { kind: 'not_published'; ownerName: string | null; ownerEmail: string | null }
  | { kind: 'not_found' }
  | { kind: 'network' }
  | { kind: 'server'; status: number }

function LinkedFormRenderer({ formId, publicToken, comment, submitting, setSubmitting, onComplete }: LinkedFormRendererProps) {
  const [form, setForm] = useState<PublicForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<LoadError | null>(null)
  const [data, setData] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/api/forms/public/${publicToken}`)
      .then(async (r) => {
        if (r.status === 404) {
          try {
            const body = await r.json() as { reason?: string; ownerName?: string | null; ownerEmail?: string | null }
            if (body.reason === 'not_published') {
              setLoadError({ kind: 'not_published', ownerName: body.ownerName ?? null, ownerEmail: body.ownerEmail ?? null })
            } else {
              setLoadError({ kind: 'not_found' })
            }
          } catch {
            setLoadError({ kind: 'not_found' })
          }
          return null
        }
        if (!r.ok) { setLoadError({ kind: 'server', status: r.status }); return null }
        return r.json() as Promise<PublicForm>
      })
      .then((f) => { if (f) setForm(f) })
      .catch(() => setLoadError({ kind: 'network' }))
      .finally(() => setLoading(false))
  }, [publicToken])

  function setField(id: string, value: unknown) {
    setData((p) => ({ ...p, [id]: value }))
    setErrors((e) => { if (!e[id]) return e; const n = { ...e }; delete n[id]; return n })
  }

  async function handleSubmit() {
    if (!form) return
    const dataFields = form.fields.filter((f) => f.type !== 'section')
    const errs: Record<string, string> = {}
    for (const f of dataFields) {
      const err = fieldError(f, data[f.id])
      if (err) errs[f.id] = err
    }
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`${API_URL}/api/forms/public/${publicToken}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })
      if (!res.ok) throw new Error('Erreur lors de la soumission du formulaire')
      const { id: formResponseId } = await res.json() as { id: string }
      const fieldMeta = form.fields
        .filter((f) => f.type !== 'section')
        .map((f) => ({ id: f.id, label: f.label }))
      await onComplete({ formResponseId, answers: data, fields: fieldMeta }, comment)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Une erreur est survenue. Réessayez.')
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
  if (loadError?.kind === 'not_published') return (
    <div className="flex flex-col gap-2 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
      <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Ce formulaire n&apos;est pas encore publié.</p>
      <p className="text-xs text-amber-600 dark:text-amber-500">
        Un responsable doit le publier dans le module Formulaires avant que cette étape soit accessible.
        {loadError.ownerName && <> Contact : {loadError.ownerName}{loadError.ownerEmail ? ` (${loadError.ownerEmail})` : ''}.</>}
      </p>
      <a href={`/forms/${formId}/edit`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 underline flex items-center gap-1">
        <ExternalLink className="w-3 h-3" /> Aller au formulaire
      </a>
    </div>
  )
  if (loadError?.kind === 'not_found') return <p className="text-sm text-red-500">Formulaire introuvable.</p>
  if (loadError?.kind === 'network') return <p className="text-sm text-red-500">Impossible de charger le formulaire. Vérifiez votre connexion.</p>
  if (loadError?.kind === 'server') return <p className="text-sm text-red-500">Erreur serveur ({loadError.status}). Réessayez plus tard.</p>
  if (!form) return <p className="text-sm text-red-500">Impossible de charger le formulaire.</p>
  if (!form.acceptingResponses) return <p className="text-sm text-gray-500 dark:text-gray-400">Ce formulaire n&apos;accepte plus de réponses.</p>

  const dataFields = form.fields.filter((f) => f.type !== 'section')

  return (
    <div className="flex flex-col gap-4">
      {dataFields.map((f) => (
        <div key={f.id} className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <FormFieldInput
            field={f}
            value={data[f.id]}
            onChange={(v) => setField(f.id, v)}
            error={errors[f.id]}
            disabled={submitting}
          />
        </div>
      ))}
      {submitError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {submitError}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="self-start px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
      >
        {submitting ? 'Enregistrement…' : 'Valider'}
      </button>
    </div>
  )
}

const CLASS_LEVELS: ParcourDocClass[] = ['C0', 'C1', 'C2', 'C3']

function allowedClasses(maxClass?: ParcourDocClass): ParcourDocClass[] {
  const cap = maxClass ?? 'C3'
  return CLASS_LEVELS.slice(0, CLASS_LEVELS.indexOf(cap) + 1)
}

interface CreatedResource {
  type: string
  id: string
  title: string
  url: string
  code?: string
}

interface Props {
  step: StepDef
  nextStep?: StepDef | null
  stepIndex: number
  stepData?: Record<string, unknown> | null
  /** Nombre de documents déjà enregistrés pour cette étape (persistés en base). */
  existingDocCount?: number
  onComplete: (action: 'complete' | 'reject', data?: Record<string, unknown>, comment?: string) => Promise<void>
  onDirtyChange?: (isDirty: boolean) => void
  getUploadUrl?: (filename: string, mimeType: string) => Promise<{ uploadUrl: string; key: string }>
  registerDocument?: (doc: {
    storageKey: string; filename: string; mimeType: string
    sizeBytes: number; classification?: ParcourDocClass; stepIndex?: number
  }) => Promise<void>
}

export function StepRenderer({ step, nextStep, stepIndex, stepData, existingDocCount = 0, onComplete, onDirtyChange, getUploadUrl, registerDocument }: Props) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [uploadedKey, setUploadedKey] = useState<string | null>(null)
  const [classification, setClassification] = useState<ParcourDocClass>('C1')
  const [extraUploadState, setExtraUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
  const [extraUploaded, setExtraUploaded] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const extraFileRef = useRef<HTMLInputElement>(null)

  function updateFormData(key: string, value: unknown) {
    const next = { ...formData, [key]: value }
    setFormData(next)
    // Effacer l'erreur du champ si l'utilisateur le remplit
    if (fieldErrors[key]) setFieldErrors((e) => { const n = { ...e }; delete n[key]; return n })
    onDirtyChange?.(true)
  }

  function validateForm(): boolean {
    if (step.type !== 'form' || !step.fields) return true
    const errors: Record<string, string> = {}
    for (const field of step.fields) {
      if (!field.required) continue
      const val = formData[field.id]
      if (val === undefined || val === null || val === '' || val === false) {
        errors[field.id] = 'Ce champ est requis'
      }
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleComplete(action: 'complete' | 'reject') {
    if (action === 'complete' && !validateForm()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onComplete(action, formData, comment || undefined)
      onDirtyChange?.(false)
    } catch {
      setSubmitError('Une erreur est survenue. Réessayez.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !getUploadUrl || !registerDocument) return
    setUploadState('uploading')
    try {
      const { uploadUrl, key } = await getUploadUrl(file.name, file.type)
      const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!res.ok) throw new Error(`Upload échoué: ${res.status}`)
      setUploadedKey(key)
      await registerDocument({ storageKey: key, filename: file.name, mimeType: file.type, sizeBytes: file.size, classification, stepIndex })
      setUploadState('done')
    } catch {
      setUploadState('error')
    }
  }

  async function handleExtraFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !getUploadUrl || !registerDocument) return
    setExtraUploadState('uploading')
    try {
      const { uploadUrl, key } = await getUploadUrl(file.name, file.type)
      const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!res.ok) throw new Error(`Upload échoué: ${res.status}`)
      await registerDocument({ storageKey: key, filename: file.name, mimeType: file.type, sizeBytes: file.size, classification: 'C1', stepIndex })
      setExtraUploaded(true)
      setExtraUploadState('done')
    } catch {
      setExtraUploadState('error')
    }
  }

  const classes = allowedClasses(step.maxClass)
  // Un document est présent s'il vient d'être uploadé (état local) OU s'il existe déjà en base.
  const hasDocument = !!uploadedKey || existingDocCount > 0

  return (
    <div className="flex flex-col gap-5">
      {/* Info step */}
      {step.type === 'info' && step.body && (
        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap m-0">{step.body}</p>
        </div>
      )}

      {/* Form step — formulaire lié (module Forms) */}
      {step.type === 'form' && step.formId && step.formPublicToken && (
        <LinkedFormRenderer
          formId={step.formId}
          publicToken={step.formPublicToken}
          comment={comment}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onComplete={async (data, cmt) => {
            await onComplete('complete', data, cmt || undefined)
            onDirtyChange?.(false)
          }}
        />
      )}

      {/* Form step — champs inline */}
      {step.type === 'form' && step.fields && !step.formId && (
        <div className="flex flex-col gap-4">
          {step.fields.map((field) => (
            <div key={field.id}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={(formData[field.id] as string) ?? ''}
                  onChange={(e) => updateFormData(field.id, e.target.value)}
                  rows={3}
                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none ${fieldErrors[field.id] ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}
                />
              ) : field.type === 'select' && field.options ? (
                <select
                  value={(formData[field.id] as string) ?? ''}
                  onChange={(e) => updateFormData(field.id, e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${fieldErrors[field.id] ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}
                >
                  <option value="">Choisir…</option>
                  {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : field.type === 'checkbox' ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData[field.id] as boolean) ?? false}
                    onChange={(e) => updateFormData(field.id, e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{field.required ? 'Confirmer' : 'Oui'}</span>
                </label>
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  value={(formData[field.id] as string) ?? ''}
                  onChange={(e) => updateFormData(field.id, e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${fieldErrors[field.id] ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'}`}
                />
              )}
              {fieldErrors[field.id] && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />{fieldErrors[field.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Document step */}
      {step.type === 'document' && (
        <div className="flex flex-col gap-3">
          {step.instructions && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{step.instructions}</p>
          )}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Classification</label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value as ParcourDocClass)}
              disabled={uploadState === 'done'}
              className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50"
            >
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadState === 'uploading' || uploadState === 'done'}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-cyan-300 dark:hover:border-cyan-700 text-sm text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-50"
          >
            {uploadState === 'uploading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</>
              : uploadState === 'done' ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> Document chargé</>
              : uploadState === 'error' ? <><XCircle className="w-4 h-4 text-red-500" /> Erreur — réessayer</>
              : <><Upload className="w-4 h-4" /> Choisir un fichier</>
            }
          </button>
        </div>
      )}

      {/* Module step — formulaire lié */}
      {step.type === 'module' && step.moduleId === 'forms' && step.formId && step.formPublicToken && (
        <LinkedFormRenderer
          formId={step.formId}
          publicToken={step.formPublicToken}
          comment={comment}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onComplete={async (data, cmt) => {
            await onComplete('complete', data, cmt || undefined)
            onDirtyChange?.(false)
          }}
        />
      )}

      {/* Module step — lien vers module */}
      {step.type === 'module' && !(step.moduleId === 'forms' && step.formId) && (() => {
        const mod = PIVOT_MODULES.find((m) => m.id === step.moduleId)
        const created = stepData as CreatedResource | null
        const href = created?.url ?? step.moduleHref ?? mod?.nav[0]?.href ?? '/'
        const linkLabel = created ? created.title : (mod?.name ?? 'le module')
        return (
          <div className="flex flex-col gap-3">
            {mod && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <span className="text-2xl leading-none">{mod.icon}</span>
                <div>
                  <div className="font-medium text-sm dark:text-white">{mod.name}</div>
                  {step.instructions && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{step.instructions}</div>}
                </div>
              </div>
            )}
            {created && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Créé automatiquement : <span className="font-medium">{created.title}</span>
              </div>
            )}
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 text-sm font-medium hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ouvrir {linkLabel}
            </a>
          </div>
        )
      })()}

      {/* Document joint requis (steps form/info avec requireDocument) */}
      {step.requireDocument && step.type !== 'document' && (
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Document joint requis</p>
          <input ref={extraFileRef} type="file" className="hidden" onChange={handleExtraFileChange} />
          <button
            onClick={() => extraFileRef.current?.click()}
            disabled={extraUploadState === 'uploading' || extraUploadState === 'done'}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 hover:border-cyan-300 dark:hover:border-cyan-700 text-sm text-gray-500 dark:text-gray-400 transition-colors disabled:opacity-50"
          >
            {extraUploadState === 'uploading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</>
              : extraUploadState === 'done' ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> Document joint</>
              : extraUploadState === 'error' ? <><XCircle className="w-4 h-4 text-red-500" /> Erreur — réessayer</>
              : <><Upload className="w-4 h-4" /> Joindre un document</>
            }
          </button>
        </div>
      )}

      {/* Nomination du prochain validateur (mode nominated) */}
      {nextStep?.type === 'validation' && nextStep.assignmentMode === 'nominated' && nextStep.nominatedFromGroup && nextStep.nominatedFromGroup.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1.5">
            Nommer le prochain validateur <span className="text-red-500">*</span>
          </label>
          <select
            value={(formData.nomineeId as string) ?? ''}
            onChange={(e) => updateFormData('nomineeId', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="">— choisir dans {nextStep.groupLabel ?? 'le groupe'} —</option>
            {nextStep.nominatedFromGroup.map((m) => (
              <option key={m.id} value={m.id}>{m.label ?? m.id}</option>
            ))}
          </select>
        </div>
      )}

      {/* Comment */}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Commentaire (optionnel)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          placeholder="Ajouter un commentaire…"
          className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
        />
      </div>

      {/* Erreur soumission */}
      {submitError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {submitError}
        </div>
      )}

      {/* Actions — masqué pour les formulaires liés (ils ont leur propre bouton Valider) */}
      {!(
        (step.type === 'form' && step.formId) ||
        (step.type === 'module' && step.moduleId === 'forms' && step.formId)
      ) && (
        <div className="flex gap-3">
          <button
            onClick={() => handleComplete('complete')}
            disabled={submitting || (step.type === 'document' && !hasDocument) || (!!step.requireDocument && step.type !== 'document' && !extraUploaded && existingDocCount === 0)}
            className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {submitting ? 'Enregistrement…' : 'Valider'}
          </button>
          <button
            onClick={() => handleComplete('reject')}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
            title="Rejeter cette étape (l'instance reste active)"
          >
            Rejeter
          </button>
        </div>
      )}
    </div>
  )
}
