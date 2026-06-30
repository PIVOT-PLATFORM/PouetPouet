'use client'

import { useState, useEffect } from 'react'
import { Plus, GripVertical, Trash2, ChevronDown, ChevronUp, ExternalLink, AlertTriangle } from 'lucide-react'
import { PIVOT_MODULES } from '@pouetpouet/shared'
import type { StepDef, FormField, FormSummary } from '@pouetpouet/shared'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const STEP_TYPES = [
  { value: 'info',     label: 'Information',  description: 'Affiche un texte à lire' },
  { value: 'form',     label: 'Formulaire',   description: 'Collecte des données' },
  { value: 'document', label: 'Document',     description: 'Demande un fichier' },
  { value: 'approval', label: 'Validation',   description: 'Approbation d\'un responsable' },
  { value: 'email',    label: 'Email',        description: 'Envoi automatique d\'email' },
  { value: 'module',   label: 'Module Pivot', description: 'Lien vers un autre module' },
]

interface Props {
  steps: StepDef[]
  onChange: (steps: StepDef[]) => void
}

function makeDefaultStep(type: StepDef['type']): StepDef {
  return { type, title: '' }
}

function StepItem({ step, index, total, onChange, onDelete, onMove, onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }: {
  step: StepDef; index: number; total: number
  onChange: (s: StepDef) => void; onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
  isDragOver: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const [availableForms, setAvailableForms] = useState<Pick<FormSummary, 'id' | 'title' | 'publicToken' | 'isPublished'>[]>([])

  useEffect(() => {
    if (step.type !== 'form' || !expanded) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
    if (!token) return
    fetch(`${API_URL}/api/forms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : [])
      .then((list: Pick<FormSummary, 'id' | 'title' | 'publicToken' | 'isPublished'>[]) => setAvailableForms(list))
      .catch(() => {})
  }, [step.type, expanded])

  function updateField(key: keyof StepDef, value: unknown) {
    onChange({ ...step, [key]: value } as StepDef)
  }

  function changeType(type: StepDef['type']) {
    onChange({ type, title: step.title })
  }

  function addFormField() {
    const fields: FormField[] = [...(step.fields ?? []), {
      id: `field_${Date.now()}`, label: '', type: 'text', required: false,
    }]
    onChange({ ...step, fields })
  }

  function updateFormField(idx: number, patch: Partial<FormField>) {
    const fields = [...(step.fields ?? [])]
    fields[idx] = { ...fields[idx], ...patch }
    onChange({ ...step, fields })
  }

  function removeFormField(idx: number) {
    const fields = [...(step.fields ?? [])]
    fields.splice(idx, 1)
    onChange({ ...step, fields })
  }

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver() }}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
      onDragEnd={onDragEnd}
      className={`rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden transition-all ${
        isDragOver ? 'border-cyan-400 dark:border-cyan-600 shadow-md' : 'border-gray-100 dark:border-gray-800'
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
        <GripVertical className="w-4 h-4 text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0" />
        <span className="text-xs font-medium text-gray-400 w-5 flex-shrink-0">{index + 1}</span>
        <input
          value={step.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Titre de l'étape"
          className="flex-1 text-sm font-medium bg-transparent focus:outline-none dark:text-white placeholder:text-gray-400"
        />
        <select
          value={step.type}
          onChange={(e) => changeType(e.target.value as StepDef['type'])}
          className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer flex-shrink-0"
        >
          {STEP_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <div className="flex gap-1 flex-shrink-0">
          <button disabled={index === 0} onClick={() => onMove(-1)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors">
            <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button disabled={index === total - 1} onClick={() => onMove(1)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors">
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <button onClick={() => setExpanded((v) => !v)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-4 flex flex-col gap-3">
          {step.type === 'info' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Contenu</label>
              <textarea
                value={step.body ?? ''}
                onChange={(e) => updateField('body', e.target.value)}
                rows={3}
                placeholder="Texte affiché au participant…"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
              />
            </div>
          )}

          {(step.type === 'info' || step.type === 'form') && (
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={step.requireDocument ?? false}
                onChange={(e) => updateField('requireDocument', e.target.checked || undefined)}
                className="w-4 h-4 rounded text-cyan-500"
              />
              <span className="text-gray-600 dark:text-gray-400">Exiger un document joint</span>
            </label>
          )}

          {step.type === 'form' && (
            <div className="flex flex-col gap-3">
              {/* Toggle inline / lié */}
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-gray-400">
                  <input
                    type="radio"
                    name={`form-mode-${index}`}
                    checked={step.formId === undefined}
                    onChange={() => onChange({ ...step, formId: undefined, formPublicToken: undefined })}
                    className="w-3.5 h-3.5 text-cyan-500"
                  />
                  Champs inline
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-gray-400">
                  <input
                    type="radio"
                    name={`form-mode-${index}`}
                    checked={step.formId !== undefined}
                    onChange={() => onChange({ ...step, fields: undefined, formId: '', formPublicToken: '' })}
                    className="w-3.5 h-3.5 text-cyan-500"
                  />
                  Formulaire lié (module Forms)
                </label>
              </div>

              {/* Mode lié */}
              {step.formId !== undefined && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={step.formId ?? ''}
                      onChange={(e) => {
                        const selected = availableForms.find((f) => f.id === e.target.value)
                        onChange({ ...step, formId: selected?.id ?? '', formPublicToken: selected?.publicToken ?? '' })
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    >
                      <option value="">Choisir un formulaire…</option>
                      {availableForms.map((f) => (
                        <option key={f.id} value={f.id}>{f.title}</option>
                      ))}
                    </select>
                    {step.formId && (
                      <a
                        href={`/forms/${step.formId}/edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-gray-400 hover:text-cyan-500 transition-colors"
                        title="Ouvrir le formulaire"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  {step.formId && availableForms.find((f) => f.id === step.formId)?.isPublished === false && (
                    <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Ce formulaire est un brouillon — publiez-le pour qu&apos;il soit accessible dans ce workflow.
                    </p>
                  )}
                </div>
              )}

              {/* Mode inline */}
              {step.formId === undefined && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Champs</label>
                    <button onClick={addFormField} className="text-xs text-cyan-500 hover:text-cyan-600 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Ajouter un champ
                    </button>
                  </div>
                  {(step.fields ?? []).map((field, fi) => (
                    <div key={field.id} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
                      <input
                        value={field.label}
                        onChange={(e) => updateFormField(fi, { label: e.target.value })}
                        placeholder="Label"
                        className="flex-1 text-sm bg-transparent focus:outline-none dark:text-white"
                      />
                      <select
                        value={field.type}
                        onChange={(e) => updateFormField(fi, { type: e.target.value as FormField['type'] })}
                        className="text-xs bg-transparent text-gray-500 dark:text-gray-400 focus:outline-none"
                      >
                        {['text', 'textarea', 'number', 'date', 'select', 'checkbox'].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateFormField(fi, { required: e.target.checked })}
                          className="w-3 h-3 rounded text-cyan-500"
                        />
                        Requis
                      </label>
                      <button onClick={() => removeFormField(fi)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step.type === 'document' && (
            <div className="flex flex-col gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Instructions</label>
                <input
                  value={step.instructions ?? ''}
                  onChange={(e) => updateField('instructions', e.target.value)}
                  placeholder="Ex : Uploader le rapport d'audit signé"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Classification max</label>
                <select
                  value={step.maxClass ?? 'C1'}
                  onChange={(e) => updateField('maxClass', e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  {['C0', 'C1', 'C2', 'C3'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}

          {(step.type === 'approval' || step.type === 'form') && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Assigné à (email, optionnel)</label>
              <input
                value={step.assignedTo ?? ''}
                onChange={(e) => updateField('assignedTo', e.target.value)}
                placeholder="prenom.nom@entreprise.fr"
                type="email"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>
          )}

          {step.type === 'module' && (
            <div className="flex flex-col gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Module</label>
                <select
                  value={step.moduleId ?? ''}
                  onChange={(e) => updateField('moduleId', e.target.value || undefined)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="">Choisir un module…</option>
                  {PIVOT_MODULES.filter((m) => m.id !== 'parcours').map((m) => (
                    <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Action automatique (optionnel)</label>
                <select
                  value={step.moduleAction ?? ''}
                  onChange={(e) => updateField('moduleAction', e.target.value || undefined)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value="">Aucune — lien simple vers le module</option>
                  <option value="create_board">🧀 Créer un board PouetPouet</option>
                  <option value="create_meeting">🗓️ Créer une réunion MeetOps</option>
                  <option value="create_daily">☀️ Créer une session Daily</option>
                  <option value="create_scrum">🃏 Créer une room Scrum Poker</option>
                </select>
              </div>
              {step.moduleAction && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Titre de la ressource (optionnel)</label>
                  <input
                    value={step.moduleParams?.title ?? ''}
                    onChange={(e) => updateField('moduleParams', e.target.value ? { title: e.target.value } : undefined)}
                    placeholder="Par défaut : titre du parcours"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Instructions (optionnel)</label>
                <textarea
                  value={step.instructions ?? ''}
                  onChange={(e) => updateField('instructions', e.target.value || undefined)}
                  rows={2}
                  placeholder="Ce que le participant doit faire dans ce module…"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
                />
              </div>
              {!step.moduleAction && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">URL spécifique (optionnel)</label>
                  <input
                    value={step.moduleHref ?? ''}
                    onChange={(e) => updateField('moduleHref', e.target.value || undefined)}
                    placeholder="Ex : /scrum/ma-room"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function StepBuilder({ steps, onChange }: Props) {
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  function addStep(type: StepDef['type']) {
    onChange([...steps, makeDefaultStep(type)])
    setShowTypeMenu(false)
  }

  function updateStep(idx: number, step: StepDef) {
    const next = [...steps]
    next[idx] = step
    onChange(next)
  }

  function deleteStep(idx: number) {
    onChange(steps.filter((_, i) => i !== idx))
  }

  function moveStep(idx: number, dir: -1 | 1) {
    const next = [...steps]
    const target = idx + dir
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  function handleDrop() {
    if (draggedIdx !== null && dragOverIdx !== null && draggedIdx !== dragOverIdx) {
      const next = [...steps]
      const [removed] = next.splice(draggedIdx, 1)
      next.splice(dragOverIdx, 0, removed)
      onChange(next)
    }
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  function handleDragEnd() {
    setDraggedIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div className="flex flex-col gap-3">
      {steps.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-gray-400">
          <p className="text-sm">Aucune étape. Ajoutez-en une pour commencer.</p>
        </div>
      )}

      {steps.map((step, idx) => (
        <StepItem
          key={idx}
          step={step}
          index={idx}
          total={steps.length}
          onChange={(s) => updateStep(idx, s)}
          onDelete={() => deleteStep(idx)}
          onMove={(dir) => moveStep(idx, dir)}
          onDragStart={() => setDraggedIdx(idx)}
          onDragOver={() => setDragOverIdx(idx)}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          isDragOver={dragOverIdx === idx && draggedIdx !== idx}
        />
      ))}

      <div className="relative">
        <button
          onClick={() => setShowTypeMenu((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-cyan-300 dark:hover:border-cyan-700 text-sm text-gray-500 dark:text-gray-400 w-full justify-center transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter une étape
        </button>

        {showTypeMenu && (
          <div className="absolute bottom-full mb-2 left-0 right-0 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg overflow-hidden z-10">
            {STEP_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => addStep(t.value as StepDef['type'])}
                className="flex items-start gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors"
              >
                <div>
                  <div className="text-sm font-medium dark:text-white">{t.label}</div>
                  <div className="text-xs text-gray-400">{t.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
