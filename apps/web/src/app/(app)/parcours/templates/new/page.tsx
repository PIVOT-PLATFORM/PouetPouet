'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useParcourTemplates } from '@/hooks/useParcours'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { FlowBuilder, type FlowBuilderState } from '@/components/parcours/FlowBuilder'
import type { StepDef } from '@pouetpouet/shared'
import { api } from '@/lib/api'
import { AlertCircle, CheckCircle2, Save, Rocket } from 'lucide-react'

const CATEGORIES = ['cyber', 'archi', 'onboarding', 'qualite', 'rh', 'it', 'autre']

// ─── Validation pré-publication ───────────────────────────────────────────────

type ValidationIssue = { stepIdx?: number; message: string; blocking: boolean }

async function validateForPublish(state: FlowBuilderState): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const { steps, triggerType, triggerConfig } = state

  if (steps.length === 0) {
    issues.push({ message: 'Le workflow doit contenir au moins une étape', blocking: true })
    return issues
  }

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    const label = `Étape ${i + 1} "${s.title || 'sans titre'}"`

    if (!s.title?.trim()) {
      issues.push({ stepIdx: i, message: `${label} : titre obligatoire`, blocking: true })
    }

    switch (s.type) {
      case 'form':
        if (s.formId) {
          try {
            await api.get(`/api/forms/${s.formId}`)
          } catch {
            issues.push({ stepIdx: i, message: `${label} : formulaire lié introuvable (id: ${s.formId})`, blocking: true })
          }
        }
        break

      case 'http':
        if (!s.httpUrl?.trim()) {
          issues.push({ stepIdx: i, message: `${label} : URL HTTP obligatoire`, blocking: true })
        } else if (!/^https?:\/\/.+/.test(s.httpUrl)) {
          issues.push({ stepIdx: i, message: `${label} : URL HTTP invalide (doit commencer par http:// ou https://)`, blocking: true })
        }
        break

      case 'approval':
        if (!s.assignedTo?.trim()) {
          issues.push({ stepIdx: i, message: `${label} : aucun valideur assigné`, blocking: false })
        }
        break

      case 'approval-chain':
        if (!s.approvers?.length) {
          issues.push({ stepIdx: i, message: `${label} : aucun approbateur défini`, blocking: true })
        }
        break

      case 'email':
        if (!s.to?.trim()) {
          issues.push({ stepIdx: i, message: `${label} : destinataire email obligatoire`, blocking: true })
        }
        break

      case 'module':
        if (!s.moduleAction) {
          issues.push({ stepIdx: i, message: `${label} : action module obligatoire`, blocking: true })
        }
        break
    }
  }

  // Trigger form_response : vérifier le formId
  if (triggerType === 'form_response') {
    if (!triggerConfig.formId?.trim()) {
      issues.push({ message: 'Déclencheur "réponse formulaire" : ID formulaire obligatoire', blocking: true })
    } else {
      try {
        await api.get(`/api/forms/${triggerConfig.formId}`)
      } catch {
        issues.push({ message: `Déclencheur : formulaire déclencheur introuvable (id: ${triggerConfig.formId})`, blocking: true })
      }
    }
  }

  return issues
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewTemplatePage() {
  useFlagGuard('module.parcours')
  const router = useRouter()
  const { createTemplate } = useParcourTemplates()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')

  const [flowState, setFlowState] = useState<FlowBuilderState>({
    steps: [],
    flowEdges: [],
    triggerType: 'manual',
    triggerConfig: {},
  })

  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState('')
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null)

  function buildPayload() {
    return {
      name: name.trim(),
      description: description.trim() || undefined,
      category: category || undefined,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      steps: flowState.steps,
      flowEdges: flowState.flowEdges,
      triggerType: flowState.triggerType,
      triggerConfig: flowState.triggerConfig,
    }
  }

  // Sauvegarde brouillon — validation minimale (nom seulement)
  async function handleSaveDraft() {
    if (!name.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    setError('')
    setIssues(null)
    try {
      const t = await createTemplate(buildPayload())
      router.push(`/parcours/templates/${t.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde')
      setSaving(false)
    }
  }

  // Publication — validation complète d'abord
  async function handlePublish() {
    if (!name.trim()) { setError('Le nom est obligatoire.'); return }
    setError('')
    setValidating(true)
    setIssues(null)

    const foundIssues = await validateForPublish(flowState).catch((e) => {
      setError(e instanceof Error ? e.message : 'Erreur de validation')
      return null
    })
    setValidating(false)

    if (!foundIssues) return

    const blocking = foundIssues.filter((i) => i.blocking)
    setIssues(foundIssues)

    if (blocking.length > 0) return // arrêt si erreurs bloquantes

    // Toutes les vérifications passent (warnings non-bloquants OK)
    setSaving(true)
    try {
      const t = await createTemplate(buildPayload())
      router.push(`/parcours/templates/${t.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la création')
      setSaving(false)
    }
  }

  const hasBlockingIssues = issues?.some((i) => i.blocking) ?? false

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/parcours/templates" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-1 inline-block">
          ← Templates
        </Link>
        <h1 className="text-3xl font-bold dark:text-white">Nouveau template</h1>
      </div>

      {/* Métadonnées */}
      <div className="flex flex-col gap-4 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 max-w-2xl">
        <h2 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Informations</h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Nom <span className="text-red-500">*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Parcours cyber entrant"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Description du parcours…"
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none" />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Catégorie</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50">
              <option value="">Sans catégorie</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tags (séparés par des virgules)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="audit, sécurité…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50" />
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex flex-col gap-3 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Flux d'étapes <span className="text-gray-400 font-normal normal-case ml-1">({flowState.steps.length} étape{flowState.steps.length > 1 ? 's' : ''})</span>
          </h2>
        </div>
        <FlowBuilder
          steps={flowState.steps}
          flowEdges={flowState.flowEdges}
          triggerType={flowState.triggerType}
          triggerConfig={flowState.triggerConfig}
          onChange={setFlowState}
        />
      </div>

      {/* Résultats de validation */}
      {issues && issues.length > 0 && (
        <div className="flex flex-col gap-2 max-w-2xl">
          {issues.map((issue, i) => (
            <div key={i} className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${issue.blocking ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
              {issue.blocking
                ? <AlertCircle size={15} className="shrink-0 mt-0.5" />
                : <AlertCircle size={15} className="shrink-0 mt-0.5 opacity-70" />}
              {issue.message}
            </div>
          ))}
        </div>
      )}

      {issues && !hasBlockingIssues && issues.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm max-w-2xl">
          <CheckCircle2 size={15} className="shrink-0" />
          Avertissements non bloquants — publication possible
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl max-w-2xl">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 max-w-2xl">
        <Link href="/parcours/templates"
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          Annuler
        </Link>

        <button onClick={handleSaveDraft} disabled={saving || validating}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <Save size={14} />
          {saving ? 'Sauvegarde…' : 'Enregistrer le brouillon'}
        </button>

        <button onClick={handlePublish} disabled={saving || validating}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
          <Rocket size={14} />
          {validating ? 'Validation…' : saving ? 'Création…' : 'Valider et créer'}
        </button>
      </div>
    </div>
  )
}
