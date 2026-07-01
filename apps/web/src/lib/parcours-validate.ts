import { api } from '@/lib/api'
import type { FlowBuilderState } from '@/components/parcours/FlowBuilder'

export type ValidationIssue = { stepIdx?: number; message: string; blocking: boolean }

export async function validateForPublish(state: FlowBuilderState): Promise<ValidationIssue[]> {
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
          try { await api.get(`/api/forms/${s.formId}`) }
          catch { issues.push({ stepIdx: i, message: `${label} : formulaire lié introuvable (id: ${s.formId})`, blocking: true }) }
        }
        break
      case 'http':
        if (!s.httpUrl?.trim()) {
          issues.push({ stepIdx: i, message: `${label} : URL HTTP obligatoire`, blocking: true })
        } else if (!/^https?:\/\/.+/.test(s.httpUrl)) {
          issues.push({ stepIdx: i, message: `${label} : URL HTTP invalide (doit commencer par http:// ou https://)`, blocking: true })
        }
        break
      case 'ai-prompt':
        if (!s.aiPrompt?.trim()) {
          issues.push({ stepIdx: i, message: `${label} : prompt IA obligatoire`, blocking: true })
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
      case 'validation': {
        const mode = s.assignmentMode ?? 'user'
        if (mode === 'user' && !s.assignedTo?.trim()) {
          issues.push({ stepIdx: i, message: `${label} : aucun valideur assigné`, blocking: false })
        } else if ((mode === 'group' || mode === 'chain') && !s.groupMembers?.length) {
          issues.push({ stepIdx: i, message: `${label} : aucun membre de groupe défini`, blocking: true })
        } else if (mode === 'nominated' && !s.nominatedFromGroup?.length) {
          issues.push({ stepIdx: i, message: `${label} : liste de candidats vide (mode nommé)`, blocking: true })
        }
        break
      }
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

  if (triggerType === 'form_response') {
    if (!triggerConfig.formId?.trim()) {
      issues.push({ message: 'Déclencheur "réponse formulaire" : ID formulaire obligatoire', blocking: true })
    } else {
      try { await api.get(`/api/forms/${triggerConfig.formId}`) }
      catch { issues.push({ message: `Déclencheur : formulaire déclencheur introuvable (id: ${triggerConfig.formId})`, blocking: true }) }
    }
  }

  return issues
}
