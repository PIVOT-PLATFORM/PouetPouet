'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useParcourTemplates } from '@/hooks/useParcours'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { FlowBuilder, type FlowBuilderState } from '@/components/parcours/FlowBuilder'
import { AlertCircle, CheckCircle2, Save, Rocket, Upload } from 'lucide-react'
import { validateForPublish, type ValidationIssue } from '@/lib/parcours-validate'

const CATEGORIES = ['cyber', 'archi', 'onboarding', 'qualite', 'rh', 'it', 'autre']

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
  // FlowBuilder copie ses props dans son state au montage (pas de re-sync) : on force
  // un remount via cette clé après un import JSON pour qu'il reparte du nouvel état.
  const [flowKey, setFlowKey] = useState(0)

  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState('')
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importError, setImportError] = useState('')

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

  function handleImportApply() {
    setImportError('')
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(importJson)
    } catch {
      setImportError('JSON invalide — vérifiez la syntaxe.')
      return
    }
    if (parsed.name && typeof parsed.name === 'string') setName(parsed.name)
    if (parsed.description && typeof parsed.description === 'string') setDescription(parsed.description)
    if (parsed.category && typeof parsed.category === 'string') setCategory(parsed.category)
    if (Array.isArray(parsed.tags)) setTags((parsed.tags as string[]).join(', '))
    setFlowState({
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      flowEdges: Array.isArray(parsed.flowEdges) ? parsed.flowEdges : [],
      triggerType: (parsed.triggerType as 'manual' | 'form_response') ?? 'manual',
      triggerConfig: (parsed.triggerConfig as Record<string, unknown>) ?? {},
    })
    setFlowKey((k) => k + 1) // remonte FlowBuilder sur le nouvel état importé
    setImportOpen(false)
    setImportJson('')
  }

  const hasBlockingIssues = issues?.some((i) => i.blocking) ?? false

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/parcours/templates" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-1 inline-block">
            ← Templates
          </Link>
          <h1 className="text-3xl font-bold dark:text-white">Nouveau template</h1>
        </div>
        <button onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors mt-2">
          <Upload size={14} />
          Importer JSON
        </button>
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
          key={flowKey}
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

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 w-full max-w-2xl flex flex-col gap-4 shadow-2xl">
            <div>
              <h2 className="font-semibold text-base dark:text-white">Importer un workflow JSON</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Collez le JSON généré par une IA ou exporté depuis un autre workflow. Les champs nom, étapes et arêtes seront chargés dans l'éditeur.
              </p>
            </div>
            <textarea
              value={importJson}
              onChange={(e) => { setImportJson(e.target.value); setImportError('') }}
              rows={12}
              placeholder={'{\n  "name": "Mon workflow",\n  "steps": [...],\n  "flowEdges": [...]\n}'}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs font-mono dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none"
            />
            {importError && (
              <p className="text-sm text-red-500 flex items-center gap-1.5">
                <AlertCircle size={14} /> {importError}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setImportOpen(false); setImportJson(''); setImportError('') }}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Annuler
              </button>
              <button onClick={handleImportApply} disabled={!importJson.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors">
                <Upload size={14} />
                Charger dans l'éditeur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
