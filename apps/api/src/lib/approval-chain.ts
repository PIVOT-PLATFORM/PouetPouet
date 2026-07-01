// Service d'approbation générique pour les étapes de type 'approval-chain'.
// Les approbateurs sont définis directement dans la configuration de l'étape
// (liste ordonnée de userId), sans dépendance LDAP ni OrgUnit.
//
// Chaque étape approval-chain stocke dans stepInstance.data :
//   { approvals: { userId, decision, comment, at }[], currentApproverIndex: number }
//
// requireAll: true  → tous les approbateurs doivent approuver (défaut)
// requireAll: false → premier approbateur qui approuve suffit

export type ApprovalDecision = {
  userId: string
  decision: 'approved' | 'rejected'
  comment?: string
  at: string // ISO
}

export type ApprovalChainData = {
  approvals: ApprovalDecision[]
  currentApproverIndex: number
}

export function initApprovalChain(): ApprovalChainData {
  return { approvals: [], currentApproverIndex: 0 }
}

export function currentApprover(approvers: string[], data: ApprovalChainData): string | null {
  return approvers[data.currentApproverIndex] ?? null
}

export function canDecide(userId: string, approvers: string[], data: ApprovalChainData): boolean {
  return approvers[data.currentApproverIndex] === userId
}

// Enregistre une décision. Retourne le nouvel état + si la chaîne est résolue.
export function recordDecision(
  approvers: string[],
  data: ApprovalChainData,
  decision: ApprovalDecision,
  requireAll = true,
): { next: ApprovalChainData; resolved: boolean; outcome: 'approved' | 'rejected' | 'pending' } {
  const approvals = [...data.approvals, decision]

  if (decision.decision === 'rejected') {
    // Un rejet met fin à la chaîne quelle que soit la config
    return { next: { approvals, currentApproverIndex: data.currentApproverIndex }, resolved: true, outcome: 'rejected' }
  }

  if (!requireAll) {
    // Premier approbateur positif suffit
    return { next: { approvals, currentApproverIndex: data.currentApproverIndex }, resolved: true, outcome: 'approved' }
  }

  const nextIndex = data.currentApproverIndex + 1
  if (nextIndex >= approvers.length) {
    // Tous ont approuvé
    return { next: { approvals, currentApproverIndex: nextIndex }, resolved: true, outcome: 'approved' }
  }

  return {
    next: { approvals, currentApproverIndex: nextIndex },
    resolved: false,
    outcome: 'pending',
  }
}
