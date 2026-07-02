'use client'

import { useState } from 'react'
import {
  CheckCircle2, XCircle, Clock, RotateCcw, CheckCheck, Pencil,
  ChevronLeft, ChevronRight, User, FileText, AlertCircle, ExternalLink,
  SkipForward, Lock, AlertTriangle, MessageSquare,
} from 'lucide-react'
import type { StepDef, ParcourStepInstanceDetail, StepStatus, ParcourDocClass, ParcourDocumentSummary, ParcourHistoryEntry } from '@pouetpouet/shared'
import { StepRenderer } from './StepRenderer'

const STEP_TYPE_LABEL: Record<string, string> = {
  info: 'Info', form: 'Formulaire', document: 'Document',
  approval: 'Validation', email: 'Email', module: 'Module',
}

const STATUS_BADGE: Record<StepStatus, { label: string; cls: string }> = {
  PENDING:   { label: 'En attente', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400' },
  COMPLETED: { label: 'Complété',   cls: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
  REJECTED:  { label: 'Rejeté',     cls: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' },
  SKIPPED:   { label: 'Passé',      cls: 'bg-gray-100 dark:bg-gray-800 text-gray-400' },
}

function CompletedDataSummary({ step, data }: { step: StepDef; data: Record<string, unknown> | null }) {
  if (step.type === 'info') return <p className="text-sm text-gray-400 italic">Lu et confirmé.</p>
  if (step.type === 'document') return <p className="text-sm text-gray-400 italic">Document uploadé.</p>
  if (step.type === 'approval') return <p className="text-sm text-gray-400 italic">Approuvé.</p>
  if (step.type === 'module' && data?.url) return (
    <a href={data.url as string} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
      <ExternalLink className="w-3.5 h-3.5" />
      {(data.title as string) ?? 'Voir la ressource créée'}
    </a>
  )
  // Module Pivot → Formulaires : même affichage qu'un form step lié
  if (step.type === 'module' && step.moduleId === 'forms' && step.formId && data?.formResponseId) {
    const fields = (data.fields as { id: string; label: string }[] | undefined) ?? []
    const answers = (data.answers as Record<string, unknown> | undefined) ?? {}
    const pairs = fields.map((f) => ({ label: f.label, value: answers[f.id] }))
    const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
    if (pairs.length === 0) return <p className="text-sm text-gray-400 italic">Formulaire soumis.</p>
    return (
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {pairs.map((p) => (
            <div key={p.label} className="px-3 py-2.5">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{p.label}</p>
              {isEmpty(p.value)
                ? <p className="text-xs text-gray-300 dark:text-gray-600 italic">—</p>
                : <p className="text-sm text-gray-800 dark:text-gray-100">{Array.isArray(p.value) ? p.value.join(', ') : String(p.value)}</p>
              }
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <a
            href={`/forms/${step.formId}/responses`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> Voir toutes les réponses
          </a>
        </div>
      </div>
    )
  }
  if (step.type === 'form' && step.formId && data?.formResponseId) {
    const fields = (data.fields as { id: string; label: string }[] | undefined) ?? []
    const answers = (data.answers as Record<string, unknown> | undefined) ?? {}
    const pairs = fields.map((f) => ({ label: f.label, value: answers[f.id] }))
    const isEmpty = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
    if (pairs.length === 0) return (
      <p className="text-sm text-gray-400 italic">Formulaire soumis.</p>
    )
    return (
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {pairs.map((p) => (
            <div key={p.label} className="px-3 py-2.5">
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{p.label}</p>
              {isEmpty(p.value)
                ? <p className="text-xs text-gray-300 dark:text-gray-600 italic">—</p>
                : <p className="text-sm text-gray-800 dark:text-gray-100">{Array.isArray(p.value) ? p.value.join(', ') : String(p.value)}</p>
              }
            </div>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <a
            href={`/forms/${step.formId}/responses`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> Voir toutes les réponses
          </a>
        </div>
      </div>
    )
  }
  if (step.type === 'form' && step.fields) {
    const pairs = step.fields.map((f) => ({ label: f.label, value: data?.[f.id] }))
      .filter((p) => p.value !== undefined && p.value !== null && p.value !== '')
    if (pairs.length === 0) return <p className="text-sm text-gray-400 italic">Formulaire soumis (données vides).</p>
    return (
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
        {pairs.map((p) => (
          <div key={p.label} className="px-3 py-2.5">
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">{p.label}</p>
            <p className="text-sm text-gray-800 dark:text-gray-100">{String(p.value)}</p>
          </div>
        ))}
      </div>
    )
  }
  return null
}

interface Props {
  steps: StepDef[]
  stepInstances: ParcourStepInstanceDetail[]
  documents: ParcourDocumentSummary[]
  history: ParcourHistoryEntry[]
  selectedStep: number
  currentStep: number
  instanceStatus: string
  canEdit: boolean
  onComplete: (idx: number, body: { action: 'complete' | 'reject'; data?: Record<string, unknown>; comment?: string }) => Promise<void>
  onForceComplete: (idx: number, data?: Record<string, unknown>, comment?: string) => void
  onSkip: (idx: number, comment?: string) => void
  onReset: (idx: number) => void
  onUpdateData: (idx: number, data: Record<string, unknown>) => void
  onAddStepComment: (stepIdx: number, comment: string) => Promise<void>
  onNavigate: (idx: number) => void
  getUploadUrl: (filename: string, mimeType: string) => Promise<{ uploadUrl: string; key: string }>
  registerDocument: (doc: {
    storageKey: string; filename: string; mimeType: string
    sizeBytes: number; classification?: ParcourDocClass; stepIndex?: number
  }) => Promise<void>
}

export function StepDetailPanel({
  steps, stepInstances, documents, history, selectedStep, currentStep, instanceStatus, canEdit,
  onComplete, onForceComplete, onSkip, onReset, onUpdateData, onAddStepComment, onNavigate,
  getUploadUrl, registerDocument,
}: Props) {
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [forceCompleteMode, setForceCompleteMode] = useState(false)
  const [forceData, setForceData] = useState<Record<string, unknown>>({})
  const [forceComment, setForceComment] = useState('')
  const [isFormDirty, setIsFormDirty] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [stepComment, setStepComment] = useState('')
  const [sendingStepComment, setSendingStepComment] = useState(false)

  const step = steps[selectedStep]
  const si = stepInstances.find((s) => s.stepIndex === selectedStep)
  const status: StepStatus = si?.status ?? 'PENDING'
  const stepComments = history.filter((h) => h.stepIndex === selectedStep && h.action === 'comment')
  const isActive = instanceStatus === 'IN_PROGRESS'
  const isCurrent = selectedStep === currentStep && status === 'PENDING' && isActive
  const isFuturePending = status === 'PENDING' && !isCurrent
  const isOverdue = status === 'PENDING' && !!si?.dueAt && new Date(si.dueAt) < new Date()
  const stepDocs = documents.filter((d) => d.stepIndex === selectedStep)

  if (!step) return null

  const borderCls = isCurrent
    ? 'border-cyan-200 dark:border-cyan-800'
    : status === 'REJECTED'
    ? 'border-red-200 dark:border-red-900'
    : isOverdue
    ? 'border-orange-200 dark:border-orange-900'
    : status === 'COMPLETED'
    ? 'border-green-100 dark:border-green-900/30'
    : 'border-gray-100 dark:border-gray-800'

  function navigateTo(idx: number) {
    if (isFormDirty && isCurrent) {
      if (!confirm('Vous avez des données non soumises. Quitter cette étape ?')) return
      setIsFormDirty(false)
    }
    setEditMode(false)
    setForceCompleteMode(false)
    setActionError(null)
    onNavigate(idx)
  }

  async function withError(action: () => Promise<void>) {
    setActionError(null)
    try {
      await action()
    } catch {
      setActionError('Une erreur est survenue. Réessayez.')
    }
  }

  async function handleSaveEdit() {
    setSaving(true)
    await withError(async () => {
      await onUpdateData(selectedStep, editData)
      setEditMode(false)
    })
    setSaving(false)
  }

  async function handleForceComplete() {
    if (step.type === 'form' && step.fields && step.fields.length > 0) {
      setForceCompleteMode(true)
      setForceData({})
      return
    }
    if (!confirm(`Valider manuellement l'étape ${selectedStep + 1} ?`)) return
    await withError(async () => { onForceComplete(selectedStep, undefined, undefined) })
  }

  async function handleForceCompleteSubmit() {
    await withError(async () => {
      onForceComplete(selectedStep, forceData, forceComment || undefined)
      setForceCompleteMode(false)
    })
  }

  async function handleSkip() {
    const comment = window.prompt(`Raison du passage (optionnel) :`)
    if (comment === null) return // annulé (prompt renvoie null sur Annuler)
    await withError(async () => { onSkip(selectedStep, comment || undefined) })
  }

  async function handleReset() {
    if (!confirm(`Réinitialiser l'étape ${selectedStep + 1} ? Elle repassera à "En attente".`)) return
    await withError(async () => { onReset(selectedStep) })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigateTo(selectedStep - 1)}
          disabled={selectedStep === 0}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-gray-500 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-gray-400 dark:text-gray-500 flex-1 text-center">
          Étape {selectedStep + 1} / {steps.length}
        </span>
        <button
          onClick={() => navigateTo(selectedStep + 1)}
          disabled={selectedStep === steps.length - 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-gray-500 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Carte principale */}
      <div className={`p-5 rounded-2xl border bg-white dark:bg-gray-900 flex flex-col gap-4 ${borderCls}`}>

        {/* En-tête */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {STEP_TYPE_LABEL[step.type] ?? step.type}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[status].cls}`}>
              {STATUS_BADGE[status].label}
            </span>
            {isCurrent && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 font-medium">
                À compléter
              </span>
            )}
            {isOverdue && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> En retard
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold dark:text-white">{step.title}</h2>
          <div className="flex items-center gap-4 flex-wrap">
            {step.assignedLabel && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <User className="w-3 h-3" />{step.assignedLabel}
              </span>
            )}
            {si?.dueAt && status === 'PENDING' && (
              <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-orange-500' : 'text-gray-400'}`}>
                <Clock className="w-3 h-3" />
                {isOverdue ? 'En retard · ' : 'Échéance : '}
                {new Date(si.dueAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
              </span>
            )}
            {si?.completedAt && (status === 'COMPLETED' || status === 'SKIPPED') && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {new Date(si.completedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800" />

        {/* Erreur action */}
        {actionError && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {actionError}
          </div>
        )}

        {/* ── Étape courante active ── */}
        {isCurrent && (
          <>
            <StepRenderer
              step={step}
              nextStep={steps[selectedStep + 1] ?? null}
              stepIndex={selectedStep}
              stepData={si?.data}
              existingDocCount={stepDocs.length}
              onComplete={(action, data, comment) => onComplete(selectedStep, { action, data, comment })}
              onDirtyChange={setIsFormDirty}
              getUploadUrl={getUploadUrl}
              registerDocument={registerDocument}
            />
            {/* Passer l'étape */}
            {canEdit && (
              <button
                onClick={handleSkip}
                className="self-start flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Passer cette étape
              </button>
            )}
          </>
        )}

        {/* ── Étape future verrouillée ── */}
        {isFuturePending && (
          <div className="flex flex-col gap-4">
            {/* Bannière "verrouillée" */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-400">
              <Lock className="w-3.5 h-3.5 flex-shrink-0" />
              Cette étape n'est pas encore active.
            </div>

            {/* Aperçu du contenu — lecture seule */}
            {step.type === 'info' && step.body && (
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-400 whitespace-pre-wrap opacity-60">
                {step.body}
              </div>
            )}
            {step.type === 'form' && step.fields && step.fields.length > 0 && (
              <div className="flex flex-col gap-1 opacity-60">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Champs à remplir</p>
                {step.fields.map((f) => (
                  <div key={f.id} className="text-sm text-gray-400">· {f.label}{f.required ? ' *' : ''}</div>
                ))}
              </div>
            )}
            {(step.type === 'document' || step.type === 'approval') && step.instructions && (
              <p className="text-sm text-gray-400 opacity-60">{step.instructions}</p>
            )}

            {/* Valider manuellement */}
            {canEdit && isActive && !forceCompleteMode && (
              <button
                onClick={handleForceComplete}
                className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 text-xs font-medium hover:bg-cyan-100 dark:hover:bg-cyan-900/40 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Valider manuellement
              </button>
            )}

            {/* Formulaire de force-complete pour les form steps */}
            {forceCompleteMode && step.type === 'form' && step.fields && (
              <div className="flex flex-col gap-3 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900 bg-cyan-50/30 dark:bg-cyan-900/10">
                <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400">Remplir et valider manuellement</p>
                {step.fields.map((f) => (
                  <div key={f.id}>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {f.label}{f.required ? ' *' : ''}
                    </label>
                    <input
                      type="text"
                      value={(forceData[f.id] as string) ?? ''}
                      onChange={(e) => setForceData((p) => ({ ...p, [f.id]: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>
                ))}
                <input
                  type="text"
                  value={forceComment}
                  onChange={(e) => setForceComment(e.target.value)}
                  placeholder="Commentaire (optionnel)"
                  className="w-full px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleForceCompleteSubmit}
                    className="flex-1 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-medium transition-colors"
                  >
                    Valider
                  </button>
                  <button
                    onClick={() => setForceCompleteMode(false)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Étape complétée ── */}
        {status === 'COMPLETED' && (
          <div className="flex flex-col gap-4">
            {editMode && step.type === 'form' && step.fields ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Modifier les données</p>
                {step.fields.map((f) => (
                  <div key={f.id}>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{f.label}</label>
                    <input
                      type="text"
                      value={(editData[f.id] as string) ?? (si?.data?.[f.id] as string) ?? ''}
                      onChange={(e) => setEditData((p) => ({ ...p, [f.id]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={handleSaveEdit} disabled={saving}
                    className="flex-1 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs font-medium transition-colors">
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button onClick={() => setEditMode(false)}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <CompletedDataSummary step={step} data={si?.data ?? null} />
            )}

            {si?.data && (si.data as Record<string, unknown>).comment != null && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600 dark:text-gray-300 italic">{String((si.data as Record<string, unknown>).comment)}</p>
              </div>
            )}

            {stepDocs.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Documents</p>
                {stepDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <FileText className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
                    <span className="truncate flex-1">{doc.filename}</span>
                    <span className="text-xs text-gray-400">{doc.classification}</span>
                  </div>
                ))}
              </div>
            )}

            {canEdit && !editMode && (
              <div className="flex items-center gap-2">
                {step.type === 'form' && step.fields && (
                  <button onClick={() => { setEditMode(true); setEditData({ ...(si?.data as Record<string, unknown> ?? {}) }) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Pencil className="w-3 h-3" /> Modifier
                  </button>
                )}
                <button onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-900 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                  <RotateCcw className="w-3 h-3" /> Réinitialiser
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Étape rejetée ── */}
        {status === 'REJECTED' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900">
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">Étape rejetée</p>
                {si?.data && (si.data as Record<string, unknown>).comment != null && (
                  <p className="text-xs text-red-500/80 mt-0.5">{String((si.data as Record<string, unknown>).comment)}</p>
                )}
                <p className="text-xs text-red-400 mt-1">Réinitialisez cette étape pour la traiter à nouveau.</p>
              </div>
            </div>
            {canEdit && (
              <button onClick={handleReset}
                className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-900 text-xs text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors">
                <RotateCcw className="w-3 h-3" /> Réinitialiser l'étape
              </button>
            )}
          </div>
        )}

        {/* ── Étape passée (skipped) ── */}
        {status === 'SKIPPED' && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-400 italic">Cette étape a été passée.</p>
            {canEdit && (
              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <RotateCcw className="w-3 h-3" /> Réinitialiser
              </button>
            )}
          </div>
        )}

        {/* ── Commentaires de l'étape ── */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 flex flex-col gap-3">
          <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Commentaires{stepComments.length > 0 && <span className="ml-1">({stepComments.length})</span>}
          </h4>
          {stepComments.length > 0 && (
            <div className="flex flex-col gap-2">
              {stepComments.map((c) => (
                <div key={c.id} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 flex flex-col gap-0.5">
                  <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words">{c.comment}</p>
                  <span className="text-[11px] text-gray-400">
                    {new Date(c.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
          {canEdit && (
            <div className="flex gap-2">
              <textarea
                value={stepComment}
                onChange={(e) => setStepComment(e.target.value)}
                rows={2}
                placeholder="Ajouter un commentaire sur cette étape…"
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && stepComment.trim()) {
                    setSendingStepComment(true)
                    try { await onAddStepComment(selectedStep, stepComment.trim()); setStepComment('') }
                    finally { setSendingStepComment(false) }
                  }
                }}
              />
              <button
                disabled={!stepComment.trim() || sendingStepComment}
                onClick={async () => {
                  if (!stepComment.trim()) return
                  setSendingStepComment(true)
                  try { await onAddStepComment(selectedStep, stepComment.trim()); setStepComment('') }
                  finally { setSendingStepComment(false) }
                }}
                className="self-end p-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
