'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Play, Save, Rocket, AlertCircle, CheckCircle2, Download } from 'lucide-react'
import { useParcourTemplate } from '@/hooks/useParcours'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { FlowBuilder, type FlowBuilderState } from '@/components/parcours/FlowBuilder'
import { StartInstanceModal } from '@/components/parcours/StartInstanceModal'
import { validateForPublish, type ValidationIssue } from '@/lib/parcours-validate'

const CATEGORIES = ['cyber', 'archi', 'onboarding', 'qualite', 'rh', 'it', 'autre']

export default function TemplateDetailPage() {
  useFlagGuard('module.parcours')
  const { id } = useParams<{ id: string }>()
  const { template, isLoading, accessDenied, updateTemplate } = useParcourTemplate(id)

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

  const [flowReady, setFlowReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState('')
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null)
  const [starting, setStarting] = useState(false)

  // Initialise les champs quand le template est chargé — flowReady retarde le montage
  // du FlowBuilder jusqu'à ce que flowState soit correct (évite useState(initSteps=[]))
  useEffect(() => {
    if (!template) return
    setName(template.name)
    setDescription(template.description ?? '')
    setCategory(template.category ?? '')
    setTags(template.tags.join(', '))
    setFlowState({
      steps: template.steps,
      flowEdges: template.flowEdges,
      triggerType: template.triggerType,
      triggerConfig: template.triggerConfig,
    })
    setFlowReady(true)
  }, [template])

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

  async function handleSave() {
    if (!name.trim()) { setError('Le nom est obligatoire.'); return }
    setSaving(true)
    setError('')
    setIssues(null)
    try {
      await updateTemplate(buildPayload())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  function handleExportJson() {
    const payload = {
      name,
      description: description || undefined,
      category: category || undefined,
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      triggerType: flowState.triggerType,
      triggerConfig: flowState.triggerConfig,
      steps: flowState.steps,
      flowEdges: flowState.flowEdges,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wf-${name.trim().toLowerCase().replace(/\s+/g, '-') || 'template'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleValidateAndSave() {
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

    if (blocking.length > 0) return

    setSaving(true)
    try {
      await updateTemplate(buildPayload())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (accessDenied || !template) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-gray-500 dark:text-gray-400">Template introuvable ou accès refusé.</p>
      <Link href="/parcours/templates" className="text-cyan-500 hover:underline text-sm">← Retour aux templates</Link>
    </div>
  )

  const hasBlockingIssues = issues?.some((i) => i.blocking) ?? false
  const isViewer = template.role === 'VIEWER'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/parcours/templates" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-1 inline-block">
          ← Templates
        </Link>
        <h1 className="text-3xl font-bold dark:text-white">{template.name}</h1>
      </div>

      {/* Métadonnées */}
      <div className="flex flex-col gap-4 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 max-w-2xl">
        <h2 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Informations</h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Nom <span className="text-red-500">*</span></label>
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={isViewer}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={isViewer}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none disabled:opacity-60" />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Catégorie</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={isViewer}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60">
              <option value="">Sans catégorie</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tags (séparés par des virgules)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} disabled={isViewer}
              placeholder="audit, sécurité…"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60" />
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
        {flowReady && (
          <FlowBuilder
            steps={flowState.steps}
            flowEdges={flowState.flowEdges}
            triggerType={flowState.triggerType}
            triggerConfig={flowState.triggerConfig}
            onChange={isViewer ? () => {} : setFlowState}
          />
        )}
      </div>

      {/* Résultats de validation */}
      {issues && issues.length > 0 && (
        <div className="flex flex-col gap-2 max-w-2xl">
          {issues.map((issue, i) => (
            <div key={i} className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm ${issue.blocking ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'}`}>
              <AlertCircle size={15} className={`shrink-0 mt-0.5 ${!issue.blocking ? 'opacity-70' : ''}`} />
              {issue.message}
            </div>
          ))}
        </div>
      )}

      {issues && !hasBlockingIssues && issues.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm max-w-2xl">
          <CheckCircle2 size={15} className="shrink-0" />
          Avertissements non bloquants — sauvegarde possible
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl max-w-2xl">{error}</p>
      )}

      {/* Actions */}
      {!isViewer && (
        <div className="flex gap-3 max-w-2xl flex-wrap">
          <button onClick={() => setStarting(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors">
            <Play size={14} />
            Démarrer
          </button>

          <button onClick={handleSave} disabled={saving || validating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <Save size={14} />
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </button>

          <button onClick={handleValidateAndSave} disabled={saving || validating}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
            <Rocket size={14} />
            {validating ? 'Validation…' : saving ? 'Sauvegarde…' : 'Valider et sauvegarder'}
          </button>

          <button onClick={handleExportJson}
            title="Télécharger ce workflow en JSON (pour le partager ou le faire modifier par une IA)"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Download size={14} />
            Exporter JSON
          </button>
        </div>
      )}

      {isViewer && (
        <div className="max-w-2xl">
          <button onClick={() => setStarting(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors">
            <Play size={14} />
            Démarrer un parcours
          </button>
        </div>
      )}

      {starting && (
        <StartInstanceModal template={template} onClose={() => setStarting(false)} />
      )}
    </div>
  )
}
