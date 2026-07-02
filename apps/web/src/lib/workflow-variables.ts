import type { StepDef, FlowEdge, TriggerType } from '@pouetpouet/shared'

export type VariableCertainty = 'certain' | 'maybe'

export type WorkflowVariable = {
  key: string            // clé technique → insérée comme {{key}}
  label: string          // nom lisible affiché dans le picker
  sourceStepIndex: number  // -1 = trigger
  sourceStepTitle: string
  certainty: VariableCertainty
  hint: string
}

export type FormFieldInfo = { id: string; label: string; type: string }

// Une étape est "maybe" si elle peut être sautée ou n'est atteignable que conditionnellement.
function computeStepCertainty(stepIdx: number, step: StepDef, flowEdges: FlowEdge[]): VariableCertainty {
  if (step.skipIf) return 'maybe'
  const incoming = flowEdges.filter((e) => e.target === String(stepIdx))
  if (incoming.length > 0 && incoming.every((e) => e.condition)) return 'maybe'
  return 'certain'
}

export function getVariablesProducedBy(
  stepIdx: number,
  step: StepDef,
  flowEdges: FlowEdge[],
  formFieldsCache?: Map<string, FormFieldInfo[]>,
): WorkflowVariable[] {
  const sourceStepTitle = `Étape ${stepIdx + 1} — ${step.title || '(sans titre)'}`
  const certainty = computeStepCertainty(stepIdx, step, flowEdges)
  const vars: WorkflowVariable[] = []

  if (step.type === 'http' && step.httpOutputKey) {
    vars.push({ key: step.httpOutputKey, label: step.httpOutputKey, sourceStepIndex: stepIdx, sourceStepTitle, certainty, hint: 'sortie HTTP (JSON)' })
  }
  if (step.type === 'ai-prompt' && step.aiOutputKey) {
    vars.push({ key: step.aiOutputKey, label: step.aiOutputKey, sourceStepIndex: stepIdx, sourceStepTitle, certainty, hint: 'sortie IA (texte)' })
  }
  if (step.type === 'form') {
    if (step.fields?.length) {
      for (const f of step.fields) {
        vars.push({ key: f.id, label: f.label || f.id, sourceStepIndex: stepIdx, sourceStepTitle, certainty, hint: `champ formulaire` })
      }
    }
    if (!step.fields?.length && step.formId) {
      const fetched = formFieldsCache?.get(step.formId)
      if (fetched?.length) {
        for (const f of fetched) {
          if (f.type === 'section') continue
          vars.push({ key: f.id, label: f.label || f.id, sourceStepIndex: stepIdx, sourceStepTitle, certainty, hint: `champ formulaire` })
        }
      } else {
        vars.push({ key: '(champs du formulaire lié)', label: '(champs du formulaire lié)', sourceStepIndex: stepIdx, sourceStepTitle, certainty, hint: `clés connues à l'exécution` })
      }
    }
  }
  if (step.type === 'validation' && step.assignmentMode === 'nominated') {
    vars.push({ key: 'nomineeId', label: 'ID du validateur nommé', sourceStepIndex: stepIdx, sourceStepTitle, certainty, hint: 'validateur nommé par cette étape' })
  }

  return vars
}

export function getVariablesAvailableAt(
  stepIndex: number,
  steps: StepDef[],
  flowEdges: FlowEdge[],
  triggerType: TriggerType,
  triggerConfig: { formId?: string; webhookTitle?: string; cronExpression?: string },
  formFieldsCache?: Map<string, FormFieldInfo[]>,
): WorkflowVariable[] {
  const vars: WorkflowVariable[] = []

  if (triggerType === 'webhook') {
    vars.push({
      key: '(clés du payload)',
      label: '(payload webhook)',
      sourceStepIndex: -1,
      sourceStepTitle: 'Déclencheur — Webhook',
      certainty: 'certain',
      hint: 'variables envoyées dans data: { … } au POST webhook',
    })
  } else if (triggerType === 'form_response') {
    const triggerFields = triggerConfig.formId ? formFieldsCache?.get(triggerConfig.formId) : undefined
    if (triggerFields?.length) {
      for (const f of triggerFields) {
        if (f.type === 'section') continue
        vars.push({
          key: f.id,
          label: f.label || f.id,
          sourceStepIndex: -1,
          sourceStepTitle: 'Déclencheur — Formulaire',
          certainty: 'certain',
          hint: 'champ du formulaire déclencheur',
        })
      }
    } else {
      vars.push({
        key: `(champs formulaire${triggerConfig.formId ? ` id:${triggerConfig.formId}` : ''})`,
        label: '(champs du formulaire déclencheur)',
        sourceStepIndex: -1,
        sourceStepTitle: 'Déclencheur — Formulaire',
        certainty: 'certain',
        hint: 'clés connues à l\'exécution',
      })
    }
  }

  for (let i = 0; i < stepIndex; i++) {
    const step = steps[i]
    if (!step) continue
    vars.push(...getVariablesProducedBy(i, step, flowEdges, formFieldsCache))
  }

  return vars
}

export type VariableGroup = {
  sourceStepIndex: number
  sourceStepTitle: string
  certainty: VariableCertainty
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
