import type { StepDef, FlowEdge, TriggerType } from '@pouetpouet/shared'

export type VariableCertainty = 'certain' | 'maybe'

export type WorkflowVariable = {
  key: string
  sourceStepIndex: number  // -1 = trigger
  sourceStepTitle: string
  certainty: VariableCertainty
  hint: string
}

// Une étape est "maybe" si elle peut être sautée ou n'est atteignable que conditionnellement.
function computeStepCertainty(stepIdx: number, step: StepDef, flowEdges: FlowEdge[]): VariableCertainty {
  if (step.skipIf) return 'maybe'
  const incoming = flowEdges.filter((e) => e.target === String(stepIdx))
  // Si toutes les arêtes entrantes ont une condition → n'est atteignable que conditionnellement
  if (incoming.length > 0 && incoming.every((e) => e.condition)) return 'maybe'
  return 'certain'
}

export function getVariablesProducedBy(
  stepIdx: number,
  step: StepDef,
  flowEdges: FlowEdge[],
): WorkflowVariable[] {
  const label = `Étape ${stepIdx + 1} — ${step.title || '(sans titre)'}`
  const certainty = computeStepCertainty(stepIdx, step, flowEdges)
  const vars: WorkflowVariable[] = []

  if (step.type === 'http' && step.httpOutputKey) {
    vars.push({ key: step.httpOutputKey, sourceStepIndex: stepIdx, sourceStepTitle: label, certainty, hint: 'sortie HTTP (JSON)' })
  }
  if (step.type === 'ai-prompt' && step.aiOutputKey) {
    vars.push({ key: step.aiOutputKey, sourceStepIndex: stepIdx, sourceStepTitle: label, certainty, hint: 'sortie IA (texte)' })
  }
  if (step.type === 'form' && step.fields?.length) {
    for (const f of step.fields) {
      vars.push({ key: f.id, sourceStepIndex: stepIdx, sourceStepTitle: label, certainty, hint: `champ formulaire : ${f.label}` })
    }
  }
  if (step.type === 'form' && !step.fields?.length && step.formId) {
    vars.push({ key: '(champs du formulaire lié)', sourceStepIndex: stepIdx, sourceStepTitle: label, certainty, hint: `formulaire id: ${step.formId} — clés connues à l'exécution` })
  }
  if (step.type === 'validation' && step.assignmentMode === 'nominated') {
    vars.push({ key: 'nomineeId', sourceStepIndex: stepIdx, sourceStepTitle: label, certainty, hint: 'validateur nommé par cet étape' })
  }

  return vars
}

export function getVariablesAvailableAt(
  stepIndex: number,
  steps: StepDef[],
  flowEdges: FlowEdge[],
  triggerType: TriggerType,
  triggerConfig: { formId?: string; webhookTitle?: string; cronExpression?: string },
): WorkflowVariable[] {
  const vars: WorkflowVariable[] = []

  // Variables issues du déclencheur
  if (triggerType === 'webhook') {
    vars.push({
      key: '(clés du payload)',
      sourceStepIndex: -1,
      sourceStepTitle: 'Déclencheur — Webhook',
      certainty: 'certain',
      hint: 'variables envoyées dans data: { … } au POST webhook',
    })
  } else if (triggerType === 'form_response') {
    vars.push({
      key: `(champs formulaire${triggerConfig.formId ? ` id:${triggerConfig.formId}` : ''})`,
      sourceStepIndex: -1,
      sourceStepTitle: 'Déclencheur — Formulaire',
      certainty: 'certain',
      hint: 'champs du formulaire déclencheur (clés = id des champs)',
    })
  }

  // Variables des étapes précédentes
  for (let i = 0; i < stepIndex; i++) {
    const step = steps[i]
    if (!step) continue
    vars.push(...getVariablesProducedBy(i, step, flowEdges))
  }

  return vars
}

// Regroupe les variables par étape source pour l'affichage
export type VariableGroup = {
  sourceStepIndex: number
  sourceStepTitle: string
  certainty: VariableCertainty  // worst-case du groupe
  variables: WorkflowVariable[]
}

export function groupVariables(vars: WorkflowVariable[]): VariableGroup[] {
  const map = new Map<number, VariableGroup>()
  for (const v of vars) {
    let g = map.get(v.sourceStepIndex)
    if (!g) {
      g = { sourceStepIndex: v.sourceStepIndex, sourceStepTitle: v.sourceStepTitle, certainty: 'certain', variables: [] }
      map.set(v.sourceStepIndex, g)
    }
    g.variables.push(v)
    if (v.certainty === 'maybe') g.certainty = 'maybe'
  }
  return Array.from(map.values()).sort((a, b) => a.sourceStepIndex - b.sourceStepIndex)
}
