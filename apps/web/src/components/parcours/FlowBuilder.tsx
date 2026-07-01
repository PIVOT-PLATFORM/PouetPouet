'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { Plus, Trash2, Zap, Globe, CheckSquare, Mail, FileText, Info, Users, Link2 } from 'lucide-react'
import type { StepDef, FlowEdge, TriggerType } from '@pouetpouet/shared'

// ─── Palette ──────────────────────────────────────────────────────────────────

const NODE_TYPES_DEF = [
  { type: 'info',           label: 'Info',           icon: Info,        color: 'bg-sky-500',    shape: 'rect' },
  { type: 'form',           label: 'Formulaire',     icon: FileText,    color: 'bg-violet-500', shape: 'rect' },
  { type: 'document',       label: 'Document',       icon: FileText,    color: 'bg-amber-500',  shape: 'rect' },
  { type: 'approval',       label: 'Validation',     icon: CheckSquare, color: 'bg-emerald-500',shape: 'diamond' },
  { type: 'approval-chain', label: 'Chaîne appro.',  icon: Users,       color: 'bg-emerald-600',shape: 'diamond' },
  { type: 'email',          label: 'Email',          icon: Mail,        color: 'bg-pink-500',   shape: 'rect' },
  { type: 'http',           label: 'HTTP',           icon: Globe,       color: 'bg-orange-500', shape: 'hexagon' },
  { type: 'module',         label: 'Module Pivot',   icon: Link2,       color: 'bg-indigo-500', shape: 'rect' },
] as const

type StepType = (typeof NODE_TYPES_DEF)[number]['type']

function getNodeDef(type: string) {
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

function rfEdgesToFlowEdges(rfEdges: Edge[]): FlowEdge[] {
  // On ne garde que les arêtes non-default (custom ou conditionnelles)
  return rfEdges
    .filter((e) => !['trigger-end', 'trigger-0'].includes(e.id) && !/^\d+-\d+$/.test(e.id) && !e.id.endsWith('-end'))
    .map((e) => ({ id: e.id, source: e.source, target: e.target, label: typeof e.label === 'string' ? e.label : undefined }))
}

// ─── Éditeur de step ─────────────────────────────────────────────────────────

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
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">ID du formulaire lié</label>
          <input value={draft.formId ?? ''} onChange={(e) => up({ formId: e.target.value || undefined })}
            placeholder="ID du formulaire…"
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white font-mono text-xs" />
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

      {draft.type === 'module' && (
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
      )}

      {/* skipIf */}
      <details className="group">
        <summary className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer select-none">
          Condition de saut (skipIf)
        </summary>
        <div className="mt-2 flex flex-col gap-2 pl-2 border-l-2 border-gray-100 dark:border-gray-700">
          <input value={draft.skipIf?.field ?? ''} placeholder="Champ (ex: statut)"
            onChange={(e) => up({ skipIf: e.target.value ? { field: e.target.value, operator: draft.skipIf?.operator ?? 'eq', value: draft.skipIf?.value ?? '' } : undefined })}
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white" />
          <select value={draft.skipIf?.operator ?? 'eq'} disabled={!draft.skipIf}
            onChange={(e) => up({ skipIf: draft.skipIf ? { ...draft.skipIf, operator: e.target.value as 'eq' | 'neq' | 'contains' } : undefined })}
            className="w-full px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white disabled:opacity-50">
            <option value="eq">égal à</option>
            <option value="neq">différent de</option>
            <option value="contains">contient</option>
          </select>
          <input value={draft.skipIf?.value ?? ''} placeholder="Valeur" disabled={!draft.skipIf}
            onChange={(e) => up({ skipIf: draft.skipIf ? { ...draft.skipIf, value: e.target.value } : undefined })}
            className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-white disabled:opacity-50" />
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
      setFlowEdges(rfEdgesToFlowEdges(next))
      return next
    })
  }, [])

  // ── Clic sur un nœud → sélection dans éditeur ──
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'trigger' || node.type === 'end') { setSelectedIdx(null); return }
    const idx = parseInt(node.id, 10)
    if (!isNaN(idx)) setSelectedIdx(idx)
  }, [])

  const onPaneClick = useCallback(() => setSelectedIdx(null), [])

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
                  <span className="text-sm dark:text-white">{t.label}</span>
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

        {selectedIdx === null && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center px-2">
            Cliquez sur une étape pour la configurer
          </p>
        )}
      </div>
    </div>
  )
}
