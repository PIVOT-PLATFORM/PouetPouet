'use client'

import { useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Zap, Globe, CheckSquare, Mail, FileText, Info, Users, Link2, Sparkles, ShieldCheck, Bell, Undo2, Redo2 } from 'lucide-react'
import type { GroupMember, ValidationNotifyConfig } from '@pouetpouet/shared'
import { api } from '@/lib/api'
import type { StepDef, FlowEdge, TriggerType, ConditionOperator, FlowCondition } from '@pouetpouet/shared'
import { getVariablesAvailableAt, getVariablesProducedBy, groupVariables, type WorkflowVariable } from '@/lib/workflow-variables'

// ─── Palette ──────────────────────────────────────────────────────────────────

const NODE_TYPES_DEF = [
  { type: 'info',        label: 'Info',          icon: Info,        color: 'bg-sky-500',    shape: 'rect',    beta: false },
  { type: 'form',        label: 'Formulaire',    icon: FileText,    color: 'bg-violet-500', shape: 'rect',    beta: false },
  { type: 'document',   label: 'Document',       icon: FileText,    color: 'bg-amber-500',  shape: 'rect',    beta: false },
  { type: 'validation', label: 'Validation',     icon: ShieldCheck, color: 'bg-emerald-500',shape: 'diamond', beta: false },
  { type: 'notification', label: 'Notification',  icon: Bell,        color: 'bg-pink-500',   shape: 'rect',    beta: false },
  { type: 'http',       label: 'HTTP',           icon: Globe,       color: 'bg-orange-500', shape: 'hexagon', beta: false },
  { type: 'module',     label: 'Module Pivot',   icon: Link2,       color: 'bg-indigo-500', shape: 'rect',    beta: false },
  { type: 'ai-prompt',  label: 'Prompt IA',      icon: Sparkles,    color: 'bg-purple-600', shape: 'hexagon', beta: true  },
] as const

type StepType = (typeof NODE_TYPES_DEF)[number]['type']

const LEGACY_NODE_DEFS = {
  'approval': { type: 'approval', label: 'Validation (legacy)', icon: CheckSquare, color: 'bg-emerald-500', shape: 'diamond', beta: false },
  'approval-chain': { type: 'approval-chain', label: 'Chaîne appro. (legacy)', icon: Users, color: 'bg-emerald-600', shape: 'diamond', beta: false },
} as const

function getNodeDef(type: string) {
  if (type in LEGACY_NODE_DEFS) return LEGACY_NODE_DEFS[type as keyof typeof LEGACY_NODE_DEFS]
  return NODE_TYPES_DEF.find((n) => n.type === type) ?? NODE_TYPES_DEF[0]
}

// ─── Nœuds personnalisés — tous avec handles Top/Bottom uniquement ────────────

// Les nœuds n'embarquent PAS de callbacks : le FlowBuilder lit selectedIdx
// pour afficher l'éditeur latéral, évitant les closures stales.

function RectNode({ data, selected }: NodeProps<Node<{ step: StepDef }>>) {
  const def = getNodeDef(data.step.type)
  const Icon = def.icon
  return (
    <div className={`relative min-w-[180px] rounded-xl border-2 bg-white dark:bg-gray-900 shadow-lg transition-all cursor-pointer ${selected ? 'border-cyan-500 shadow-cyan-200 dark:shadow-cyan-900' : 'border-gray-200 dark:border-gray-700'}`}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className={`flex-shrink-0 w-8 h-8 rounded-lg ${def.color} flex items-center justify-center`}>
          <Icon size={15} className="text-white" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{def.label}</p>
          <p className="text-sm font-semibold dark:text-white truncate max-w-[130px]">
            {data.step.title || <span className="italic text-gray-400 font-normal">Sans titre</span>}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-400" />
    </div>
  )
}

function DiamondNode({ data, selected }: NodeProps<Node<{ step: StepDef }>>) {
  const def = getNodeDef(data.step.type)
  const Icon = def.icon
  return (
    <div className="relative flex items-center justify-center cursor-pointer" style={{ width: 150, height: 110 }}>
      <Handle type="target" position={Position.Top} id="in" className="!w-4 !h-4 !bg-emerald-400 !border-2 !border-white dark:!border-gray-900 !rounded-full" style={{ top: 8 }} />
      <div
        className={`absolute rounded-xl border-2 transition-all ${selected ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20' : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'}`}
        style={{ width: 90, height: 90, transform: 'rotate(45deg)' }}
      />
      <div className="relative z-10 flex flex-col items-center gap-1">
        <span className={`w-8 h-8 rounded-lg ${def.color} flex items-center justify-center`}>
          <Icon size={15} className="text-white" />
        </span>
        <p className="text-xs font-semibold dark:text-white text-center leading-tight max-w-[100px] truncate">
          {data.step.title || <span className="italic text-gray-400 font-normal">Validation</span>}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} id="out" className="!w-4 !h-4 !bg-gray-400 !border-2 !border-white dark:!border-gray-900 !rounded-full" style={{ bottom: 8 }} />
    </div>
  )
}

function HexagonNode({ data, selected }: NodeProps<Node<{ step: StepDef }>>) {
  const def = getNodeDef(data.step.type)
  const Icon = def.icon
  return (
    <div className="relative flex items-center justify-center cursor-pointer" style={{ width: 160, height: 92 }}>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" style={{ top: 4 }} />
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 160 92" fill="none">
        <path
          d="M40 4 L120 4 L160 46 L120 88 L40 88 L0 46 Z"
          className={selected ? 'fill-orange-100 stroke-cyan-500 dark:fill-orange-900/30' : 'fill-orange-50 stroke-orange-300 dark:fill-orange-900/20 dark:stroke-orange-600'}
          strokeWidth="2"
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center gap-1">
        <span className={`w-8 h-8 rounded-lg ${def.color} flex items-center justify-center`}>
          <Icon size={15} className="text-white" />
        </span>
        <p className="text-xs font-semibold dark:text-white text-center max-w-[80px] truncate">
          {data.step.title || 'HTTP'}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-400" style={{ bottom: 4 }} />
    </div>
  )
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manuel',
  form_response: 'Réponse formulaire',
  webhook: 'Webhook entrant',
  schedule: 'Planifié (cron)',
}

function TriggerNode({ data, selected }: NodeProps<Node<{ triggerType: TriggerType; triggerConfig: { formId?: string; cronExpression?: string; cronTitle?: string; webhookTitle?: string } }>>) {
  const subtitle = data.triggerType === 'schedule' && data.triggerConfig?.cronExpression
    ? data.triggerConfig.cronExpression
    : data.triggerType === 'webhook' && data.triggerConfig?.webhookTitle
    ? data.triggerConfig.webhookTitle
    : data.triggerType === 'form_response' && data.triggerConfig?.formId
    ? `form: ${data.triggerConfig.formId.slice(0, 8)}…`
    : null
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border-2 bg-white dark:bg-gray-900 shadow-md transition-all ${selected ? 'border-cyan-500' : 'border-yellow-300 dark:border-yellow-600'}`}>
      <Zap size={16} className="text-yellow-500 flex-shrink-0" />
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Déclencheur</p>
        <p className="text-sm font-semibold dark:text-white">{TRIGGER_LABELS[data.triggerType] ?? data.triggerType}</p>
        {subtitle && <p className="text-[10px] text-gray-400 font-mono truncate max-w-[160px]">{subtitle}</p>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-yellow-400" />
    </div>
  )
}

function EndNode({ selected }: NodeProps) {
  return (
    <div className={`flex items-center justify-center w-14 h-14 rounded-full border-4 bg-white dark:bg-gray-900 shadow ${selected ? 'border-cyan-500' : 'border-gray-400 dark:border-gray-500'}`}>
      <div className="w-6 h-6 rounded-full bg-gray-400 dark:bg-gray-500" />
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" />
    </div>
  )
}

const CUSTOM_NODE_TYPES = { trigger: TriggerNode, rect: RectNode, diamond: DiamondNode, hexagon: HexagonNode, end: EndNode }

// ─── Layout vertical ─────────────────────────────────────────────────────────

const CANVAS_CX = 220
const STEP_GAP_Y = 150

function buildNodes(steps: StepDef[], triggerType: TriggerType, triggerConfig: { formId?: string; cronExpression?: string; cronTitle?: string; webhookTitle?: string }): Node[] {
  const nodes: Node[] = [
    { id: 'trigger', type: 'trigger', position: { x: CANVAS_CX - 60, y: 20 }, data: { triggerType, triggerConfig }, draggable: true },
  ]
  steps.forEach((step, idx) => {
    const shape = getNodeDef(step.type).shape
    const offsetX = shape === 'diamond' ? CANVAS_CX - 75 : CANVAS_CX - 90
    nodes.push({
      id: String(idx),
      type: shape,
      position: { x: offsetX, y: 120 + idx * STEP_GAP_Y },
      data: { step },
      draggable: true,
    })
  })
  nodes.push({ id: 'end', type: 'end', position: { x: CANVAS_CX - 28, y: 120 + steps.length * STEP_GAP_Y }, data: {}, draggable: true })
  return nodes
}

function buildDefaultEdges(steps: StepDef[], flowEdges: FlowEdge[]): Edge[] {
  // Si des arêtes custom existent, les utiliser ; sinon connexion linéaire trigger → 0 → 1 → … → end
  if (flowEdges.length > 0) return flowEdgesToRfEdges(flowEdges)
  const edges: Edge[] = []
  if (steps.length === 0) {
    edges.push({ id: 'trigger-end', source: 'trigger', target: 'end', style: { stroke: '#6b7280' } })
  } else {
    edges.push({ id: 'trigger-0', source: 'trigger', target: '0', style: { stroke: '#eab308' } })
    for (let i = 0; i < steps.length - 1; i++) {
      edges.push({ id: `${i}-${i + 1}`, source: String(i), target: String(i + 1), style: { stroke: '#6b7280' } })
    }
    edges.push({ id: `${steps.length - 1}-end`, source: String(steps.length - 1), target: 'end', style: { stroke: '#6b7280' } })
  }
  return edges
}

function flowEdgesToRfEdges(flowEdges: FlowEdge[]): Edge[] {
  return flowEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.condition ? `${e.condition.field} ${e.condition.operator} ${e.condition.value}` : (e.label ?? undefined),
    animated: !!e.condition,
    style: { stroke: e.condition ? '#f59e0b' : '#6b7280' },
  }))
}

function rfEdgesToFlowEdges(rfEdges: Edge[], existingFlowEdges: FlowEdge[]): FlowEdge[] {
  const existingById = new Map(existingFlowEdges.map((e) => [e.id, e]))
  return rfEdges
    .filter((e) => !['trigger-end', 'trigger-0'].includes(e.id) && !/^\d+-\d+$/.test(e.id) && !/^\d+-end$/.test(e.id))
    .map((e) => {
      const prev = existingById.get(e.id)
      return { id: e.id, source: e.source, target: e.target, label: typeof e.label === 'string' ? e.label : undefined, condition: prev?.condition }
    })
}

// ─── Éditeur de condition (shared entre skipIf et arêtes) ────────────────────

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'eq',       label: '= égal à' },
  { value: 'neq',      label: '≠ différent de' },
  { value: 'contains', label: '∋ contient' },
  { value: 'gt',       label: '> supérieur à' },
  { value: 'lt',       label: '< inférieur à' },
  { value: 'gte',      label: '≥ supérieur ou égal' },
  { value: 'lte',      label: '≤ inférieur ou égal' },
]

function ConditionEditor({
  condition, onChange, onClear, fieldPlaceholder = 'Champ (ex: montant)',
}: {
  condition?: FlowCondition
  onChange: (c: FlowCondition) => void
  onClear?: () => void
  fieldPlaceholder?: string
}) {
  const cond = condition ?? { field: '', operator: 'eq' as ConditionOperator, value: '' }
  return (
    <div className="flex flex-col gap-1.5">
      <input value={cond.field} placeholder={fieldPlaceholder}
        onChange={(e) => onChange({ ...cond, field: e.target.value })}
        className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
      <select value={cond.operator} onChange={(e) => onChange({ ...cond, operator: e.target.value as ConditionOperator })}
        className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white">
        {CONDITION_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      <input value={cond.value} placeholder="Valeur (ex: 40000)"
        onChange={(e) => onChange({ ...cond, value: e.target.value })}
        className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
      {onClear && (
        <button onClick={onClear} className="text-[10px] text-red-400 hover:text-red-600 text-left">
          Supprimer la condition
        </button>
      )}
    </div>
  )
}

// ─── Éditeur de step ─────────────────────────────────────────────────────────

type FormSummary = { id: string; title: string; isPublished: boolean }

function FormPicker({ value, onChange }: { value?: string; onChange: (id: string) => void }) {
  const [forms, setForms] = useState<FormSummary[]>([])
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get<FormSummary[]>('/api/forms').then(setForms).catch(() => {})
  }, [])

  async function createForm() {
    if (!newTitle.trim()) return
    setLoading(true)
    try {
      const f = await api.post<FormSummary>('/api/forms', { title: newTitle.trim() })
      setForms((prev) => [f, ...prev])
      onChange(f.id)
      setCreating(false)
      setNewTitle('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white"
      >
        <option value="">— sélectionner un formulaire —</option>
        {forms.map((f) => (
          <option key={f.id} value={f.id}>{f.title}{!f.isPublished ? ' (brouillon)' : ''}</option>
        ))}
      </select>

      {creating ? (
        <div className="flex gap-1">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createForm()}
            placeholder="Nom du nouveau formulaire…"
            autoFocus
            className="flex-1 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white"
          />
          <button onClick={createForm} disabled={loading}
            className="px-2 py-1 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium disabled:opacity-50">
            Créer
          </button>
          <button onClick={() => setCreating(false)}
            className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800">
            ✕
          </button>
        </div>
      ) : (
        <button onClick={() => setCreating(true)}
          className="text-[11px] text-violet-500 hover:text-violet-600 text-left">
          + Créer un nouveau formulaire
        </button>
      )}
    </div>
  )
}

// ─── Éditeur validation unifié ────────────────────────────────────────────────

function membersToText(members: GroupMember[]): string {
  return members.map((m) => m.label ? `${m.id}:${m.label}` : m.id).join('\n')
}

function textToMembers(text: string): GroupMember[] {
  return text.split('\n').map((line) => {
    const [id, ...rest] = line.trim().split(':')
    const label = rest.join(':').trim() || undefined
    return { id: id.trim(), ...(label ? { label } : {}) }
  }).filter((m) => m.id)
}

function ValidationEditor({ draft, up }: { draft: StepDef; up: (p: Partial<StepDef>) => void }) {
  const mode = draft.assignmentMode ?? 'user'
  const notify = draft.validationNotify ?? {}
  const upNotify = (patch: Partial<ValidationNotifyConfig>) => up({ validationNotify: { ...notify, ...patch } })

  return (
    <>
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Mode d'assignation</label>
        <select value={mode} onChange={(e) => up({ assignmentMode: e.target.value as StepDef['assignmentMode'] })}
          className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white">
          <option value="user">Personne nommée</option>
          <option value="group">Groupe (premier disponible)</option>
          <option value="chain">Chaîne (séquence obligatoire)</option>
          <option value="nominated">Nommée par la validation précédente</option>
        </select>
      </div>

      {mode === 'user' && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Assigné à (userId)</label>
          <input value={draft.assignedTo ?? ''} onChange={(e) => up({ assignedTo: e.target.value || undefined })}
            placeholder="ex: clxabc123…"
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
        </div>
      )}

      {(mode === 'group' || mode === 'chain') && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Nom du groupe</label>
            <input value={draft.groupLabel ?? ''} onChange={(e) => up({ groupLabel: e.target.value || undefined })}
              placeholder="ex: Équipe Finance"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
              Membres <span className="text-red-500">*</span>
              {mode === 'chain' && <span className="ml-1 font-normal normal-case">(dans l'ordre)</span>}
            </label>
            <p className="text-[10px] text-gray-400 mb-1">Une ligne par membre : <code>userId</code> ou <code>userId:Prénom Nom</code></p>
            <textarea rows={4} value={membersToText(draft.groupMembers ?? [])}
              onChange={(e) => up({ groupMembers: textToMembers(e.target.value) })}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white resize-none font-mono text-xs" />
          </div>
        </>
      )}

      {mode === 'nominated' && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Groupe de candidats</label>
            <p className="text-[10px] text-gray-400 mb-1">La validation précédente choisira parmi ces membres</p>
            <textarea rows={4} value={membersToText(draft.nominatedFromGroup ?? [])}
              onChange={(e) => up({ nominatedFromGroup: textToMembers(e.target.value) })}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white resize-none font-mono text-xs" />
          </div>
          <p className="text-[10px] text-amber-500 dark:text-amber-400">
            Le validateur de l'étape précédente devra nommer un candidat de ce groupe lors de sa complétion.
          </p>
        </>
      )}

      {/* Notifications */}
      <details className="group">
        <summary className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none">
          <Bell size={11} /> Notifications à l'activation
        </summary>
        <div className="mt-2 flex flex-col gap-3 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
          <label className="flex items-center gap-2 text-xs dark:text-white cursor-pointer">
            <input type="checkbox" checked={notify.email ?? true} onChange={(e) => upNotify({ email: e.target.checked })} className="rounded" />
            Email & notif in-app à l'assigné
          </label>

          <div>
            <label className="block text-[10px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">Teams webhook URL</label>
            <input value={notify.teamsWebhookUrl ?? ''} onChange={(e) => upNotify({ teamsWebhookUrl: e.target.value || undefined })}
              placeholder="https://xxx.webhook.office.com/…"
              className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Jira</label>
            <input value={notify.jiraHost ?? ''} onChange={(e) => upNotify({ jiraHost: e.target.value || undefined })}
              placeholder="https://xxx.atlassian.net" className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <input value={notify.jiraProject ?? ''} onChange={(e) => upNotify({ jiraProject: e.target.value || undefined })}
              placeholder="Clé projet (ex: DEV)" className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <input value={notify.jiraIssueType ?? ''} onChange={(e) => upNotify({ jiraIssueType: e.target.value || undefined })}
              placeholder="Type (ex: Task)" className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <input value={notify.jiraSummary ?? ''} onChange={(e) => upNotify({ jiraSummary: e.target.value || undefined })}
              placeholder="Titre du ticket (supporte {{variable}})" className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <p className="text-[10px] text-gray-400">Nécessite <code>JIRA_AUTH=user:token</code> en base64 côté API</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">OpenProject</label>
            <input value={notify.openprojectHost ?? ''} onChange={(e) => upNotify({ openprojectHost: e.target.value || undefined })}
              placeholder="https://xxx.openproject.com" className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <input value={notify.openprojectProjectId ?? ''} onChange={(e) => upNotify({ openprojectProjectId: e.target.value || undefined })}
              placeholder="ID ou identifiant du projet" className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <input value={notify.openprojectSubject ?? ''} onChange={(e) => upNotify({ openprojectSubject: e.target.value || undefined })}
              placeholder="Sujet (supporte {{variable}})" className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <p className="text-[10px] text-gray-400">Nécessite <code>OPENPROJECT_TOKEN=token</code> côté API</p>
          </div>
        </div>
      </details>
    </>
  )
}

// ─── Variable picker — insertion curseur + dropdown ───────────────────────────

function useFieldInsert(value: string, onChange: (v: string) => void) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  // Cursor position is saved on every keyup/click/select so it survives focus loss
  const savedSel = useRef<[number, number]>([value.length, value.length])

  function saveSel() {
    const el = ref.current
    if (el && el.selectionStart !== null) {
      savedSel.current = [el.selectionStart, el.selectionEnd ?? el.selectionStart]
    }
  }

  function insert(key: string) {
    const el = ref.current
    const snippet = key.startsWith('(') ? '' : `{{${key}}}`
    if (!snippet) return
    // Prefer live selection if available (element still focused), fall back to saved
    const [savedStart, savedEnd] = savedSel.current
    const start = (el && document.activeElement === el && el.selectionStart !== null)
      ? el.selectionStart
      : savedStart
    const end = (el && document.activeElement === el && el.selectionEnd !== null)
      ? (el.selectionEnd ?? start)
      : savedEnd
    const next = value.slice(0, start) + snippet + value.slice(end)
    onChange(next)
    const pos = start + snippet.length
    savedSel.current = [pos, pos]
    requestAnimationFrame(() => { el?.setSelectionRange(pos, pos); el?.focus() })
  }

  return { ref, insert, saveSel }
}

function VarPickerButton({ vars, onInsert }: { vars: WorkflowVariable[]; onInsert: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const pickable = vars.filter((v) => !v.key.startsWith('('))
  if (pickable.length === 0) return null

  function handleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    setOpen((v) => !v)
  }

  return (
    <div className="relative">
      <button ref={btnRef} type="button" onClick={handleOpen}
        title="Insérer une variable"
        className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-400 hover:text-cyan-500 hover:border-cyan-400 font-mono transition-colors">
        {'{x}'}
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
          <div className="fixed z-[201] bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl p-1.5 w-80 max-h-64 overflow-y-auto"
            style={{ top: pos.top, right: pos.right }}>
            <p className="text-[10px] text-gray-400 px-2 py-1 border-b border-gray-100 dark:border-gray-700 mb-1">Insérer au curseur</p>
            {pickable.map((v) => (
              <button key={`${v.sourceStepIndex}:${v.key}`} type="button"
                onMouseDown={(e) => { e.preventDefault(); onInsert(v.key); setOpen(false) }}
                className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${v.certainty === 'certain' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-tight">{v.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{v.sourceStepTitle}</p>
                </div>
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}

function VarTextField({
  label, required, value, onChange, availableVars, multiline, rows, placeholder, fontMono, className,
}: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void
  availableVars: WorkflowVariable[]; multiline?: boolean; rows?: number; placeholder?: string; fontMono?: boolean; className?: string
}) {
  const { ref, insert, saveSel } = useFieldInsert(value, onChange)
  const [acOpen, setAcOpen] = useState(false)
  const [acQuery, setAcQuery] = useState('')
  const [acStart, setAcStart] = useState(-1)

  const pickable = availableVars.filter((v) => !v.key.startsWith('('))
  const acFiltered = acQuery ? pickable.filter((v) => v.label.toLowerCase().includes(acQuery.toLowerCase()) || v.key.toLowerCase().includes(acQuery.toLowerCase())) : pickable

  function handleChange(newVal: string) {
    onChange(newVal)
    const el = ref.current
    const pos = el?.selectionStart ?? newVal.length
    const before = newVal.slice(0, pos)
    const match = before.match(/\{\{(\w*)$/)
    if (match && pickable.length > 0) {
      setAcQuery(match[1])
      setAcStart(before.lastIndexOf('{{'))
      setAcOpen(true)
    } else {
      setAcOpen(false)
    }
  }

  function handleAcSelect(key: string) {
    const el = ref.current
    const pos = el?.selectionStart ?? value.length
    const next = value.slice(0, acStart) + `{{${key}}}` + value.slice(pos)
    onChange(next)
    setAcOpen(false)
    const newPos = acStart + key.length + 4
    requestAnimationFrame(() => { el?.setSelectionRange(newPos, newPos); el?.focus() })
  }

  const cls = className ?? `w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white${multiline ? ' resize-none' : ''}${fontMono ? ' font-mono text-xs' : ''}`
  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <label className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <VarPickerButton vars={availableVars} onInsert={insert} />
      </div>
      {multiline
        ? <textarea ref={ref} rows={rows ?? 3} value={value}
            onChange={(e) => handleChange(e.target.value)}
            onSelect={saveSel} onKeyUp={saveSel} onMouseUp={saveSel}
            onBlur={() => { saveSel(); setTimeout(() => setAcOpen(false), 150) }}
            placeholder={placeholder} className={cls} />
        : <input ref={ref} value={value}
            onChange={(e) => handleChange(e.target.value)}
            onSelect={saveSel} onKeyUp={saveSel} onMouseUp={saveSel}
            onBlur={() => { saveSel(); setTimeout(() => setAcOpen(false), 150) }}
            placeholder={placeholder} className={cls} />
      }
      {acOpen && acFiltered.length > 0 && (
        <div className="absolute left-0 top-full mt-0.5 z-50 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-h-40 overflow-y-auto">
          {acFiltered.slice(0, 8).map((v) => (
            <button key={v.key} type="button" onMouseDown={(e) => { e.preventDefault(); handleAcSelect(v.key) }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${v.certainty === 'certain' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{v.label}</span>
              <code className="text-[9px] text-gray-400 font-mono flex-shrink-0">{'{{' + v.key + '}}'}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Éditeur de déclencheur ──────────────────────────────────────────────────

function TriggerEditor({
  triggerType, triggerConfig, onChangeType, onChangeConfig,
}: {
  triggerType: TriggerType
  triggerConfig: { formId?: string; cronExpression?: string; cronTitle?: string; webhookTitle?: string }
  onChangeType: (t: TriggerType) => void
  onChangeConfig: (c: { formId?: string; cronExpression?: string; cronTitle?: string; webhookTitle?: string }) => void
  availableVars: WorkflowVariable[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <select value={triggerType} onChange={(e) => onChangeType(e.target.value as TriggerType)}
        className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white">
        <option value="manual">Manuel</option>
        <option value="form_response">Réponse formulaire</option>
        <option value="webhook">Webhook entrant</option>
        <option value="schedule" disabled>Planifié (cron) — bientôt disponible</option>
      </select>

      {triggerType === 'manual' && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500">Déclenchement manuel — l'opérateur lance l'instance depuis l'interface.</p>
      )}

      {triggerType === 'form_response' && (
        <FormPicker value={triggerConfig.formId} onChange={(id) => onChangeConfig({ formId: id || undefined })} />
      )}

      {triggerType === 'webhook' && (
        <div className="flex flex-col gap-1.5">
          <input value={triggerConfig.webhookTitle ?? ''} onChange={(e) => onChangeConfig({ ...triggerConfig, webhookTitle: e.target.value || undefined })}
            placeholder="Titre par défaut de l'instance créée…"
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Le token webhook se configure sur la page d'édition du template.</p>
        </div>
      )}

      {triggerType === 'schedule' && (
        <div className="flex flex-col gap-1.5">
          <input value={triggerConfig.cronExpression ?? ''} onChange={(e) => onChangeConfig({ ...triggerConfig, cronExpression: e.target.value || undefined })}
            placeholder="Expression cron, ex : 0 9 * * 1"
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white font-mono text-xs" />
          <input value={triggerConfig.cronTitle ?? ''} onChange={(e) => onChangeConfig({ ...triggerConfig, cronTitle: e.target.value || undefined })}
            placeholder="Libellé (ex : Revue hebdo équipe)"
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white text-xs" />
          <div className="text-[10px] text-gray-400 dark:text-gray-500 grid grid-cols-2 gap-x-2">
            <button className="text-left hover:text-cyan-500 transition-colors" onClick={() => onChangeConfig({ ...triggerConfig, cronExpression: '0 9 * * 1' })}>0 9 * * 1 — chaque lundi 9h</button>
            <button className="text-left hover:text-cyan-500 transition-colors" onClick={() => onChangeConfig({ ...triggerConfig, cronExpression: '0 9 * * 1-5' })}>0 9 * * 1-5 — chaque jour ouvré 9h</button>
            <button className="text-left hover:text-cyan-500 transition-colors" onClick={() => onChangeConfig({ ...triggerConfig, cronExpression: '0 9 1 * *' })}>0 9 1 * * — 1er du mois 9h</button>
            <button className="text-left hover:text-cyan-500 transition-colors" onClick={() => onChangeConfig({ ...triggerConfig, cronExpression: '0 9 * * *' })}>0 9 * * * — chaque jour 9h</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Éditeur d'étape ─────────────────────────────────────────────────────────

function StepEditor({ step, onSave, onDelete, availableVars }: { step: StepDef; onSave: (s: StepDef) => void; onDelete: () => void; availableVars: WorkflowVariable[] }) {
  const [draft, setDraft] = useState<StepDef>(step)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const up = (patch: Partial<StepDef>) => setDraft((d) => ({ ...d, ...patch }))

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!draft.title.trim()) e.title = 'Le titre est requis'
    if (draft.type === 'http' && !draft.httpUrl?.trim()) e.httpUrl = 'L\'URL est requise'
    if (draft.type === 'email' && !draft.to?.trim()) e.to = 'Le destinataire est requis'
    if (draft.type === 'ai-prompt' && !draft.aiPrompt?.trim()) e.aiPrompt = 'Le prompt est requis'
    if (draft.type === 'module' && !draft.moduleAction) e.moduleAction = 'L\'action est requise'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSave() {
    if (validate()) onSave(draft)
  }

  const err = (field: string) => errors[field]
    ? <p className="text-[10px] text-red-500 mt-0.5">{errors[field]}</p>
    : null

  return (
    <div className="flex flex-col gap-3">
      <div>
        <VarTextField label="Titre" required value={draft.title} onChange={(v) => up({ title: v })}
          availableVars={availableVars}
          className={`w-full px-2 py-1.5 text-sm rounded-lg border ${errors.title ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 dark:text-white`} />
        {err('title')}
      </div>

      {/* Assigné à — tous sauf http */}
      {draft.type !== 'http' && draft.type !== 'approval-chain' && (
        <VarTextField label="Assigné à" value={draft.assignedTo ?? ''} onChange={(v) => up({ assignedTo: v || undefined })}
          availableVars={availableVars} placeholder="userId ou {{variable}}" />
      )}

      {/* SLA */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">SLA (jours)</label>
        <input type="number" min={0} value={draft.slaDays ?? ''} onChange={(e) => up({ slaDays: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
      </div>

      {/* Champs spécifiques par type */}
      {(draft.type === 'info') && (
        <VarTextField label="Corps" value={draft.body ?? ''} onChange={(v) => up({ body: v || undefined })}
          availableVars={availableVars} multiline rows={3} />
      )}

      {draft.type === 'form' && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Formulaire lié</label>
          <FormPicker value={draft.formId} onChange={(id) => up({ formId: id || undefined })} />
        </div>
      )}

      {draft.type === 'document' && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Instructions</label>
          <textarea rows={2} value={draft.instructions ?? ''} onChange={(e) => up({ instructions: e.target.value || undefined })}
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white resize-none" />
        </div>
      )}

      {(draft.type === 'email' || draft.type === 'notification') && (
        <>
          <div>
            <VarTextField label="Destinataire" required value={draft.to ?? ''} onChange={(v) => up({ to: v || undefined })}
              availableVars={availableVars} placeholder="email, userId ou {{variable}}"
              className={`w-full px-2 py-1.5 text-sm rounded-lg border ${errors.to ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 dark:text-white`} />
            {err('to')}
          </div>
          <VarTextField label="Titre / Objet" value={draft.subject ?? ''} onChange={(v) => up({ subject: v || undefined })}
            availableVars={availableVars} />
          <VarTextField label="Message" value={draft.body ?? ''} onChange={(v) => up({ body: v || undefined })}
            availableVars={availableVars} multiline rows={3} />
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Canaux</label>
            <div className="flex flex-col gap-1">
              {([['inApp', 'In-app'], ['email', 'Email']] as const).map(([ch, lbl]) => (
                <label key={ch} className="flex items-center gap-2 text-xs dark:text-white cursor-pointer">
                  <input type="checkbox" checked={draft.notifyChannels?.[ch] ?? ch === 'inApp'}
                    onChange={(e) => up({ notifyChannels: { ...draft.notifyChannels, [ch]: e.target.checked } })}
                    className="rounded" />
                  {lbl}
                </label>
              ))}
              <label className="flex items-center gap-2 text-xs dark:text-white cursor-pointer">
                <input type="checkbox" checked={!!draft.notifyChannels?.teamsWebhookUrl}
                  onChange={(e) => up({ notifyChannels: { ...draft.notifyChannels, teamsWebhookUrl: e.target.checked ? '' : undefined } })}
                  className="rounded" />
                Teams
              </label>
              {draft.notifyChannels?.teamsWebhookUrl !== undefined && (
                <input value={draft.notifyChannels.teamsWebhookUrl} onChange={(e) => up({ notifyChannels: { ...draft.notifyChannels, teamsWebhookUrl: e.target.value } })}
                  placeholder="https://xxx.webhook.office.com/…"
                  className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white font-mono" />
              )}
            </div>
          </div>
        </>
      )}

      {draft.type === 'http' && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Méthode</label>
            <select value={draft.httpMethod ?? 'GET'} onChange={(e) => up({ httpMethod: e.target.value as StepDef['httpMethod'] })}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white">
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <VarTextField label="URL" required value={draft.httpUrl ?? ''} onChange={(v) => up({ httpUrl: v || undefined })}
              availableVars={availableVars} placeholder="https://…"
              className={`w-full px-2 py-1.5 text-sm rounded-lg border ${errors.httpUrl ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 dark:text-white`} />
            {err('httpUrl')}
          </div>
          <VarTextField label="Corps (JSON template)" value={draft.httpBody ?? ''} onChange={(v) => up({ httpBody: v || undefined })}
            availableVars={availableVars} multiline rows={3} fontMono />
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Clé de sortie</label>
            <input value={draft.httpOutputKey ?? ''} onChange={(e) => up({ httpOutputKey: e.target.value || undefined })} placeholder="ex: resultat"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <p className="text-[10px] text-gray-400 mt-0.5">Stocké dans <code>{'{{resultat}}'}</code> pour les étapes suivantes</p>
          </div>
          {!draft.httpUrl && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 p-2">
              <p className="text-[10px] text-gray-400 mb-1.5 font-medium">Exemple — API JSON publique :</p>
              <button type="button" onClick={() => up({ httpMethod: 'GET', httpUrl: 'https://jsonplaceholder.typicode.com/todos/1', httpOutputKey: 'todo' })}
                className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline text-left">
                GET jsonplaceholder.typicode.com/todos/1
              </button>
            </div>
          )}
        </>
      )}

      {draft.type === 'approval-chain' && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Approbateurs <span className="text-red-500">*</span></label>
            <p className="text-[10px] text-gray-400 mb-1">Un userId par ligne, dans l'ordre</p>
            <textarea rows={4} value={(draft.approvers ?? []).join('\n')}
              onChange={(e) => up({ approvers: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white resize-none font-mono text-xs" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="requireAll" checked={draft.requireAll ?? true} onChange={(e) => up({ requireAll: e.target.checked })}
              className="rounded" />
            <label htmlFor="requireAll" className="text-xs dark:text-white">Tous doivent approuver</label>
          </div>
        </>
      )}

      {draft.type === 'validation' && (
        <ValidationEditor draft={draft} up={up} />
      )}

      {draft.type === 'module' && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Action <span className="text-red-500">*</span></label>
            <select value={draft.moduleAction ?? ''} onChange={(e) => up({ moduleAction: e.target.value as StepDef['moduleAction'] })}
              className={`w-full px-2 py-1.5 text-sm rounded-lg border ${errors.moduleAction ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 dark:text-white`}>
              <option value="">— choisir —</option>
              <option value="create_board">Créer un tableau (PouetPouet)</option>
              <option value="create_meeting">Créer une réunion (MeetOps)</option>
              <option value="create_daily">Créer un Daily</option>
              <option value="create_scrum">Créer un Scrum Poker</option>
            </select>
            {err('moduleAction')}
          </div>
          <VarTextField label="Titre du module créé" value={draft.moduleParams?.title ?? ''}
            onChange={(v) => up({ moduleParams: { ...draft.moduleParams, title: v || undefined } })}
            availableVars={availableVars} placeholder="Ex : Onboarding {{prenom}}" />
        </>
      )}

      {draft.type === 'ai-prompt' && (
        <>
          <VarTextField label="System prompt (optionnel)" value={draft.aiSystemPrompt ?? ''} onChange={(v) => up({ aiSystemPrompt: v || undefined })}
            availableVars={availableVars} multiline rows={2}
            placeholder="Ex : Tu es un expert en sécurité qui analyse des documents…" />
          <div>
            <VarTextField label="Prompt" required value={draft.aiPrompt ?? ''} onChange={(v) => up({ aiPrompt: v || undefined })}
              availableVars={availableVars} multiline rows={4}
              placeholder="Ex : Analyse le document {{document}} selon les critères d'exigences éthiques et donne une note sur 10…"
              className={`w-full px-2 py-1.5 text-sm rounded-lg border ${errors.aiPrompt ? 'border-red-400' : 'border-gray-200 dark:border-gray-700'} bg-white dark:bg-gray-800 dark:text-white resize-none`} />
            {err('aiPrompt')}
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Modèle</label>
            <select value={draft.aiModel ?? 'claude-haiku-4-5-20251001'} onChange={(e) => up({ aiModel: e.target.value })}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white">
              <option value="claude-haiku-4-5-20251001">Claude Haiku (rapide)</option>
              <option value="claude-sonnet-4-6">Claude Sonnet (équilibré)</option>
              <option value="claude-opus-4-8">Claude Opus (puissant)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Clé de sortie</label>
            <input value={draft.aiOutputKey ?? ''} onChange={(e) => up({ aiOutputKey: e.target.value || undefined })} placeholder="ex: analyse"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <p className="text-[10px] text-gray-400 mt-1">La réponse IA sera stockée dans <code>{'{{clé}}'}</code></p>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave}
          className="flex-1 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium transition-colors">
          Appliquer
        </button>
        <button onClick={onDelete}
          className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export interface FlowBuilderState {
  steps: StepDef[]
  flowEdges: FlowEdge[]
  triggerType: TriggerType
  triggerConfig: { formId?: string; cronExpression?: string; cronTitle?: string; webhookTitle?: string }
}

interface Props extends FlowBuilderState {
  onChange: (state: FlowBuilderState) => void
}

export function FlowBuilder({ steps: initSteps, flowEdges: initEdges, triggerType: initTT, triggerConfig: initTC, onChange }: Props) {
  // ── État interne (source de vérité) ──
  const [steps, setSteps] = useState<StepDef[]>(initSteps)
  const [flowEdges, setFlowEdges] = useState<FlowEdge[]>(initEdges)
  const [triggerType, setTriggerType] = useState<TriggerType>(initTT)
  const [triggerConfig, setTriggerConfig] = useState<{ formId?: string; cronExpression?: string; cronTitle?: string; webhookTitle?: string }>(initTC)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [selectedTrigger, setSelectedTrigger] = useState(false)
  const [past, setPast] = useState<FlowBuilderState[]>([])
  const [future, setFuture] = useState<FlowBuilderState[]>([])
  const [stepPickerOpen, setStepPickerOpen] = useState(false)
  const [formFieldsCache, setFormFieldsCache] = useState<Map<string, import('@/lib/workflow-variables').FormFieldInfo[]>>(new Map())

  // ── Charge les champs des formulaires référencés dans le workflow ──
  useEffect(() => {
    const ids = new Set<string>()
    if (triggerType === 'form_response' && triggerConfig.formId) ids.add(triggerConfig.formId)
    for (const s of steps) {
      if (s.type === 'form' && s.formId && !s.fields?.length) ids.add(s.formId)
    }
    for (const id of ids) {
      if (formFieldsCache.has(id)) continue
      api.get<{ fields: import('@/lib/workflow-variables').FormFieldInfo[] }>(`/api/forms/${id}`)
        .then((f) => {
          setFormFieldsCache((prev) => {
            const next = new Map(prev)
            next.set(id, f.fields ?? [])
            return next
          })
        })
        .catch(() => {})
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, triggerType, triggerConfig.formId])

  // ── Sync vers parent à chaque changement ──
  useEffect(() => {
    onChange({ steps, flowEdges, triggerType, triggerConfig })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, flowEdges, triggerType, triggerConfig])

  // ── Nodes React Flow — reconstruits depuis steps ──
  const derivedNodes = useMemo(() => buildNodes(steps, triggerType, triggerConfig), [steps, triggerType, triggerConfig])
  const derivedEdges = useMemo(() => buildDefaultEdges(steps, flowEdges), [steps, flowEdges])

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState(derivedNodes)
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState(derivedEdges)

  // Sync nodes quand steps changent (position préservée, data mise à jour)
  useEffect(() => {
    setRfNodes((prev) => {
      const newIds = new Set(derivedNodes.map((n) => n.id))
      const updated = prev
        .filter((n) => newIds.has(n.id))
        .map((n) => {
          const fresh = derivedNodes.find((d) => d.id === n.id)
          return fresh ? { ...n, data: fresh.data, type: fresh.type } : n
        })
      const existingIds = new Set(updated.map((n) => n.id))
      const added = derivedNodes.filter((n) => !existingIds.has(n.id))
      return [...updated, ...added]
    })
    setRfEdges(derivedEdges)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedNodes, derivedEdges])

  // ── Connexions manuelles → flowEdges custom ──
  const onConnect = useCallback((params: Connection) => {
    pushHistory()
    setRfEdges((es) => {
      const next = addEdge({ ...params, style: { stroke: '#6b7280' } }, es)
      setFlowEdges((prev) => rfEdgesToFlowEdges(next, prev))
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, flowEdges, triggerType, triggerConfig, past])

  // ── Clic sur un nœud → sélection dans éditeur ──
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedEdgeId(null)
    if (node.type === 'trigger') { setSelectedTrigger(true); setSelectedIdx(null); setSelectedEdgeId(null); return }
    if (node.type === 'end') { setSelectedIdx(null); return }
    setSelectedTrigger(false)
    const idx = parseInt(node.id, 10)
    if (!isNaN(idx)) setSelectedIdx(idx)
  }, [])

  // ── Clic sur une arête → éditeur de condition ──
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    // Ne pas ouvrir l'éditeur pour les arêtes auto-générées (trigger-0, 0-1, etc.)
    const isDefault = ['trigger-end', 'trigger-0'].includes(edge.id) || /^\d+-\d+$/.test(edge.id) || /^\d+-end$/.test(edge.id)
    if (isDefault) return
    setSelectedIdx(null)
    setSelectedEdgeId(edge.id)
  }, [])

  // ── Mise à jour condition d'une arête ──
  function updateEdgeCondition(edgeId: string, condition: FlowCondition | undefined) {
    pushHistory()
    setFlowEdges((prev) => prev.map((e) => e.id === edgeId ? { ...e, condition } : e))
    setRfEdges((prev) => prev.map((e) => {
      if (e.id !== edgeId) return e
      return {
        ...e,
        label: condition ? `${condition.field} ${condition.operator} ${condition.value}` : undefined,
        animated: !!condition,
        style: { stroke: condition ? '#f59e0b' : '#6b7280' },
      }
    }))
  }

  // ── Suppression d'une arête custom ──
  function deleteEdge(edgeId: string) {
    pushHistory()
    setFlowEdges((prev) => prev.filter((e) => e.id !== edgeId))
    setRfEdges((prev) => prev.filter((e) => e.id !== edgeId))
    setSelectedEdgeId(null)
  }

  const onPaneClick = useCallback(() => { setSelectedIdx(null); setSelectedEdgeId(null); setSelectedTrigger(false) }, [])

  // ── Undo / Redo ──
  function pushHistory() {
    const snap = { steps, flowEdges, triggerType, triggerConfig }
    setPast((p) => [...p.slice(-49), snap])
    setFuture([])
  }

  function undo() {
    if (!past.length) return
    const prev = past[past.length - 1]
    setFuture((f) => [{ steps, flowEdges, triggerType, triggerConfig }, ...f.slice(0, 49)])
    setPast((p) => p.slice(0, -1))
    setSteps(prev.steps); setFlowEdges(prev.flowEdges)
    setTriggerType(prev.triggerType); setTriggerConfig(prev.triggerConfig)
    setSelectedIdx(null); setSelectedEdgeId(null); setSelectedTrigger(false)
  }

  function redo() {
    if (!future.length) return
    const next = future[0]
    setPast((p) => [...p.slice(-49), { steps, flowEdges, triggerType, triggerConfig }])
    setFuture((f) => f.slice(1))
    setSteps(next.steps); setFlowEdges(next.flowEdges)
    setTriggerType(next.triggerType); setTriggerConfig(next.triggerConfig)
    setSelectedIdx(null); setSelectedEdgeId(null); setSelectedTrigger(false)
  }

  // ── Opérations sur steps ──
  function addStep(type: StepType) {
    pushHistory()
    const newStep: StepDef = { type, title: '' }
    setSteps((prev) => {
      const next = [...prev, newStep]
      setSelectedIdx(next.length - 1)
      return next
    })
  }

  function updateStep(idx: number, s: StepDef) {
    pushHistory()
    setSteps((prev) => { const next = [...prev]; next[idx] = s; return next })
  }

  function deleteStep(idx: number) {
    pushHistory()
    setSteps((prev) => prev.filter((_, i) => i !== idx))
    // Les node ids sont les index du tableau : après suppression, il faut retirer les
    // arêtes touchant l'étape supprimée ET décrémenter les références aux étapes suivantes,
    // sinon le routage conditionnel pointe vers les mauvaises étapes.
    setFlowEdges((prev) => prev
      .filter((e) => e.source !== String(idx) && e.target !== String(idx))
      .map((e) => {
        const shift = (ref: string): string => {
          const n = parseInt(ref, 10)
          return !Number.isNaN(n) && String(n) === ref && n > idx ? String(n - 1) : ref
        }
        return { ...e, source: shift(e.source), target: shift(e.target) }
      }))
    setSelectedIdx(null)
  }

  // ── Keyboard undo/redo ──
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past, future, steps, flowEdges, triggerType, triggerConfig])

  const selectedStep = selectedIdx !== null ? steps[selectedIdx] : null

  return (
    <div className="flex gap-4" style={{ height: 620 }}>
      {/* Canvas */}
      <div className="flex-1 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-950">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          nodeTypes={CUSTOM_NODE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} className="opacity-20" />
          <Controls className="!bg-white dark:!bg-gray-900 !border-gray-200 dark:!border-gray-700 !rounded-xl !shadow" />
          <MiniMap nodeColor={(n) => n.selected ? '#06b6d4' : '#d1d5db'} className="!bg-white dark:!bg-gray-900 !border-gray-200 dark:!border-gray-700 !rounded-xl" />
          <Panel position="bottom-center">
            <div className="relative mb-4">
              <button
                onClick={() => setStepPickerOpen((v) => !v)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg hover:border-cyan-400 hover:text-cyan-500 transition-colors text-sm font-medium dark:text-white"
              >
                <Plus size={15} /> Ajouter une étape
              </button>
              {stepPickerOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setStepPickerOpen(false)} />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl p-2 w-52">
                    {NODE_TYPES_DEF.map((t) => {
                      const Icon = t.icon
                      return (
                        <button key={t.type} onClick={() => { addStep(t.type as StepType); setStepPickerOpen(false) }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors">
                          <span className={`w-7 h-7 rounded-lg ${t.color} flex items-center justify-center flex-shrink-0`}>
                            <Icon size={13} className="text-white" />
                          </span>
                          <span className="text-sm dark:text-white">{t.label}</span>
                          {t.beta && <span className="text-[9px] px-1 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-semibold ml-auto">BETA</span>}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Panneau latéral */}
      <div className="w-64 flex flex-col gap-3 overflow-y-auto shrink-0">
        {/* Historique undo/redo */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">Historique</span>
            <div className="flex gap-1">
              <button onClick={undo} disabled={!past.length} title="Annuler (Ctrl+Z)"
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors">
                <Undo2 size={13} className="text-gray-500" />
              </button>
              <button onClick={redo} disabled={!future.length} title="Rétablir (Ctrl+Y)"
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors">
                <Redo2 size={13} className="text-gray-500" />
              </button>
            </div>
          </div>
        </div>

        {/* Éditeur — monté avec key pour forcer remount au changement de step */}
        {selectedStep !== null && selectedIdx !== null && (
          <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-white dark:bg-gray-900 p-3">
            <h3 className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide mb-3">
              Étape {selectedIdx + 1} — {getNodeDef(selectedStep.type).label}
            </h3>
            <StepEditor
              key={selectedIdx}
              step={selectedStep}
              onSave={(s) => updateStep(selectedIdx, s)}
              onDelete={() => deleteStep(selectedIdx)}
              availableVars={getVariablesAvailableAt(selectedIdx, steps, flowEdges, triggerType, triggerConfig, formFieldsCache)}
            />
          </div>
        )}

        {/* Variables disponibles à cette étape */}
        {selectedIdx !== null && (() => {
          const availVars = getVariablesAvailableAt(selectedIdx, steps, flowEdges, triggerType, triggerConfig, formFieldsCache)
          const producedVars = getVariablesProducedBy(selectedIdx, steps[selectedIdx]!, flowEdges, formFieldsCache)
          const groups = groupVariables(availVars)
          return (
            <details className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 group" open={availVars.length > 0 && availVars.length <= 8}>
              <summary className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none flex items-center justify-between">
                <span>Variables disponibles</span>
                <span className="font-normal normal-case text-gray-400">{availVars.filter((v) => !v.key.startsWith('(')).length} var{availVars.filter((v) => !v.key.startsWith('(')).length !== 1 ? 's' : ''}</span>
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {groups.length === 0 && (
                  <p className="text-[10px] text-gray-400 italic">Aucune variable disponible à cette étape.</p>
                )}
                {groups.map((g) => (
                  <div key={g.sourceStepIndex}>
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${g.certainty === 'certain' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      {g.sourceStepTitle}
                    </p>
                    {g.variables.map((v) => (
                      <div key={`${g.sourceStepIndex}:${v.key}`} className="flex items-start gap-1.5 pl-3 mb-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${v.certainty === 'certain' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <div className="min-w-0">
                          {v.key.startsWith('(')
                            ? <span className="text-[10px] text-gray-400 italic">{v.key}</span>
                            : <code className="text-[10px] text-cyan-600 dark:text-cyan-400">{'{{' + v.key + '}}'}</code>
                          }
                          <span className="text-[10px] text-gray-400 ml-1">— {v.hint}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                {producedVars.length > 0 && (
                  <div className="mt-1 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-1">Cette étape produit</p>
                    {producedVars.map((v) => (
                      <div key={v.key} className="flex items-start gap-1.5 pl-3 mb-0.5">
                        <span className="text-[10px] text-emerald-500">→</span>
                        <div className="min-w-0">
                          <code className="text-[10px] text-emerald-600 dark:text-emerald-400">{'{{' + v.key + '}}'}</code>
                          <span className="text-[10px] text-gray-400 ml-1">— {v.hint}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )
        })()}

        {/* Éditeur de condition d'arête */}
        {selectedEdgeId !== null && selectedIdx === null && (() => {
          const edge = flowEdges.find((e) => e.id === selectedEdgeId)
          if (!edge) return null
          return (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-gray-900 p-3">
              <h3 className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-3">
                Arête : étape {edge.source} → étape {edge.target}
              </h3>
              <ConditionEditor
                condition={edge.condition}
                onChange={(c) => updateEdgeCondition(selectedEdgeId, c)}
                onClear={() => updateEdgeCondition(selectedEdgeId, undefined)}
              />
              <button onClick={() => deleteEdge(selectedEdgeId)}
                className="mt-3 flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors">
                <Trash2 size={11} /> Supprimer cette arête
              </button>
            </div>
          )
        })()}

        {/* Éditeur de déclencheur */}
        {selectedTrigger && !selectedIdx && !selectedEdgeId && (
          <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-white dark:bg-gray-900 p-3">
            <h3 className="text-[10px] font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <Zap size={11} /> Déclencheur
            </h3>
            <TriggerEditor
              triggerType={triggerType}
              triggerConfig={triggerConfig}
              onChangeType={(t) => { setTriggerType(t); setTriggerConfig({}) }}
              onChangeConfig={setTriggerConfig}
              availableVars={[]}
            />
          </div>
        )}

        {selectedIdx === null && selectedEdgeId === null && !selectedTrigger && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-2">
            Cliquez sur une étape ou une arête pour la configurer
          </p>
        )}
      </div>
    </div>
  )
}
