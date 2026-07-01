'use client'

import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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
import { Plus, Trash2, Zap, Globe, CheckSquare, Mail, FileText, Info, Users, Link2, Sparkles, ShieldCheck, Bell } from 'lucide-react'
import type { GroupMember, ValidationNotifyConfig } from '@pouetpouet/shared'
import { api } from '@/lib/api'
import type { StepDef, FlowEdge, TriggerType, ConditionOperator, FlowCondition } from '@pouetpouet/shared'

// ─── Palette ──────────────────────────────────────────────────────────────────

const NODE_TYPES_DEF = [
  { type: 'info',        label: 'Info',          icon: Info,        color: 'bg-sky-500',    shape: 'rect',    beta: false },
  { type: 'form',        label: 'Formulaire',    icon: FileText,    color: 'bg-violet-500', shape: 'rect',    beta: false },
  { type: 'document',   label: 'Document',       icon: FileText,    color: 'bg-amber-500',  shape: 'rect',    beta: false },
  { type: 'validation', label: 'Validation',     icon: ShieldCheck, color: 'bg-emerald-500',shape: 'diamond', beta: false },
  { type: 'email',      label: 'Email',          icon: Mail,        color: 'bg-pink-500',   shape: 'rect',    beta: false },
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
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !bg-gray-400" style={{ top: 2 }} />
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
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bg-gray-400" style={{ bottom: 2 }} />
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

function TriggerNode({ data, selected }: NodeProps<Node<{ triggerType: TriggerType }>>) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full border-2 bg-white dark:bg-gray-900 shadow-md transition-all ${selected ? 'border-cyan-500' : 'border-yellow-300 dark:border-yellow-600'}`}>
      <Zap size={16} className="text-yellow-500 flex-shrink-0" />
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Déclencheur</p>
        <p className="text-sm font-semibold dark:text-white">{data.triggerType === 'form_response' ? 'Réponse formulaire' : 'Manuel'}</p>
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

function buildNodes(steps: StepDef[], triggerType: TriggerType): Node[] {
  const nodes: Node[] = [
    { id: 'trigger', type: 'trigger', position: { x: CANVAS_CX - 60, y: 20 }, data: { triggerType }, draggable: true },
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
    .filter((e) => !['trigger-end', 'trigger-0'].includes(e.id) && !/^\d+-\d+$/.test(e.id) && !e.id.endsWith('-end'))
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

function StepEditor({ step, onSave, onDelete }: { step: StepDef; onSave: (s: StepDef) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState<StepDef>(step)
  const up = (patch: Partial<StepDef>) => setDraft((d) => ({ ...d, ...patch }))

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Type</label>
        <select value={draft.type} onChange={(e) => up({ type: e.target.value as StepDef['type'] })}
          className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white">
          {NODE_TYPES_DEF.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
          Titre <span className="text-red-500">*</span>
        </label>
        <input value={draft.title} onChange={(e) => up({ title: e.target.value })}
          className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
      </div>

      {/* Assigné à — tous sauf http */}
      {draft.type !== 'http' && draft.type !== 'approval-chain' && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Assigné à (userId)</label>
          <input value={draft.assignedTo ?? ''} onChange={(e) => up({ assignedTo: e.target.value || undefined })}
            placeholder="ex: clxabc123…"
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
        </div>
      )}

      {/* SLA */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">SLA (jours)</label>
        <input type="number" min={0} value={draft.slaDays ?? ''} onChange={(e) => up({ slaDays: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
      </div>

      {/* Champs spécifiques par type */}
      {(draft.type === 'info') && (
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Corps</label>
          <textarea rows={3} value={draft.body ?? ''} onChange={(e) => up({ body: e.target.value || undefined })}
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white resize-none" />
        </div>
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

      {draft.type === 'email' && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Destinataire <span className="text-red-500">*</span></label>
            <input value={draft.to ?? ''} onChange={(e) => up({ to: e.target.value || undefined })} placeholder="email ou userId"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Objet</label>
            <input value={draft.subject ?? ''} onChange={(e) => up({ subject: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Corps</label>
            <textarea rows={3} value={draft.body ?? ''} onChange={(e) => up({ body: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white resize-none" />
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
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">URL <span className="text-red-500">*</span></label>
            <input value={draft.httpUrl ?? ''} onChange={(e) => up({ httpUrl: e.target.value || undefined })} placeholder="https://…"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <p className="text-[10px] text-gray-400 mt-1">Supporte <code>{'{{variable}}'}</code></p>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Corps (JSON template)</label>
            <textarea rows={3} value={draft.httpBody ?? ''} onChange={(e) => up({ httpBody: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white resize-none font-mono text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Clé de sortie</label>
            <input value={draft.httpOutputKey ?? ''} onChange={(e) => up({ httpOutputKey: e.target.value || undefined })} placeholder="ex: status"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
          </div>
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
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white">
              <option value="">— choisir —</option>
              <option value="create_board">Créer un tableau (PouetPouet)</option>
              <option value="create_meeting">Créer une réunion (MeetOps)</option>
              <option value="create_daily">Créer un Daily</option>
              <option value="create_scrum">Créer un Scrum Poker</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Titre du module créé</label>
            <input value={draft.moduleParams?.title ?? ''} onChange={(e) => up({ moduleParams: { ...draft.moduleParams, title: e.target.value || undefined } })}
              placeholder="Ex : Onboarding {{prenom}}"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
            <p className="text-[10px] text-gray-400 mt-1">Supporte <code>{'{{variable}}'}</code></p>
          </div>
        </>
      )}

      {draft.type === 'ai-prompt' && (
        <>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">System prompt (optionnel)</label>
            <textarea rows={2} value={draft.aiSystemPrompt ?? ''} onChange={(e) => up({ aiSystemPrompt: e.target.value || undefined })}
              placeholder="Ex : Tu es un expert en sécurité qui analyse des documents…"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white resize-none" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">Prompt <span className="text-red-500">*</span></label>
            <textarea rows={4} value={draft.aiPrompt ?? ''} onChange={(e) => up({ aiPrompt: e.target.value || undefined })}
              placeholder="Ex : Analyse le document {{document}} selon les critères d'exigences éthiques et donne une note sur 10…"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white resize-none" />
            <p className="text-[10px] text-gray-400 mt-1">Supporte <code>{'{{variable}}'}</code> depuis les données de l'instance</p>
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

      {/* skipIf */}
      <details className="group">
        <summary className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none">
          Condition de saut automatique (skipIf)
        </summary>
        <div className="mt-2 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
          <ConditionEditor
            condition={draft.skipIf}
            onChange={(c) => up({ skipIf: c })}
            onClear={() => up({ skipIf: undefined })}
            fieldPlaceholder="Champ (ex: statut)"
          />
        </div>
      </details>

      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(draft)}
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
  triggerConfig: { formId?: string }
}

interface Props extends FlowBuilderState {
  onChange: (state: FlowBuilderState) => void
}

export function FlowBuilder({ steps: initSteps, flowEdges: initEdges, triggerType: initTT, triggerConfig: initTC, onChange }: Props) {
  // ── État interne (source de vérité) ──
  const [steps, setSteps] = useState<StepDef[]>(initSteps)
  const [flowEdges, setFlowEdges] = useState<FlowEdge[]>(initEdges)
  const [triggerType, setTriggerType] = useState<TriggerType>(initTT)
  const [triggerConfig, setTriggerConfig] = useState<{ formId?: string }>(initTC)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  // ── Sync vers parent à chaque changement ──
  useEffect(() => {
    onChange({ steps, flowEdges, triggerType, triggerConfig })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, flowEdges, triggerType, triggerConfig])

  // ── Nodes React Flow — reconstruits depuis steps ──
  const derivedNodes = useMemo(() => buildNodes(steps, triggerType), [steps, triggerType])
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
    setRfEdges((es) => {
      const next = addEdge({ ...params, style: { stroke: '#6b7280' } }, es)
      setFlowEdges((prev) => rfEdgesToFlowEdges(next, prev))
      return next
    })
  }, [])

  // ── Clic sur un nœud → sélection dans éditeur ──
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedEdgeId(null)
    if (node.type === 'trigger' || node.type === 'end') { setSelectedIdx(null); return }
    const idx = parseInt(node.id, 10)
    if (!isNaN(idx)) setSelectedIdx(idx)
  }, [])

  // ── Clic sur une arête → éditeur de condition ──
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    // Ne pas ouvrir l'éditeur pour les arêtes auto-générées (trigger-0, 0-1, etc.)
    const isDefault = ['trigger-end', 'trigger-0'].includes(edge.id) || /^\d+-\d+$/.test(edge.id) || edge.id.endsWith('-end')
    if (isDefault) return
    setSelectedIdx(null)
    setSelectedEdgeId(edge.id)
  }, [])

  // ── Mise à jour condition d'une arête ──
  function updateEdgeCondition(edgeId: string, condition: FlowCondition | undefined) {
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
    setFlowEdges((prev) => prev.filter((e) => e.id !== edgeId))
    setRfEdges((prev) => prev.filter((e) => e.id !== edgeId))
    setSelectedEdgeId(null)
  }

  const onPaneClick = useCallback(() => { setSelectedIdx(null); setSelectedEdgeId(null) }, [])

  // ── Opérations sur steps ──
  function addStep(type: StepType) {
    const newStep: StepDef = { type, title: '' }
    setSteps((prev) => {
      const next = [...prev, newStep]
      setSelectedIdx(next.length - 1)
      return next
    })
  }

  function updateStep(idx: number, s: StepDef) {
    setSteps((prev) => { const next = [...prev]; next[idx] = s; return next })
  }

  function deleteStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx))
    setFlowEdges((prev) => prev.filter((e) => e.source !== String(idx) && e.target !== String(idx)))
    setSelectedIdx(null)
  }

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
        </ReactFlow>
      </div>

      {/* Panneau latéral */}
      <div className="w-64 flex flex-col gap-3 overflow-y-auto shrink-0">
        {/* Déclencheur */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
          <h3 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Déclencheur</h3>
          <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as TriggerType)}
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white mb-2">
            <option value="manual">Manuel</option>
            <option value="form_response">Réponse formulaire</option>
          </select>
          {triggerType === 'form_response' && (
            <input value={triggerConfig.formId ?? ''} onChange={(e) => setTriggerConfig({ formId: e.target.value || undefined })}
              placeholder="ID du formulaire…"
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white font-mono text-xs" />
          )}
        </div>

        {/* Palette d'ajout */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
          <h3 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
            <Plus size={11} /> Ajouter une étape
          </h3>
          <div className="flex flex-col gap-1">
            {NODE_TYPES_DEF.map((t) => {
              const Icon = t.icon
              return (
                <button key={t.type} onClick={() => addStep(t.type as StepType)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left transition-colors">
                  <span className={`w-6 h-6 rounded-md ${t.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={12} className="text-white" />
                  </span>
                  <span className="text-sm dark:text-white flex-1">{t.label}</span>
                  {t.beta && <span className="text-[9px] px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-semibold tracking-wide">BETA</span>}
                </button>
              )
            })}
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
            />
          </div>
        )}

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

        {selectedIdx === null && selectedEdgeId === null && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-2">
            Cliquez sur une étape ou une arête pour la configurer
          </p>
        )}
      </div>
    </div>
  )
}
