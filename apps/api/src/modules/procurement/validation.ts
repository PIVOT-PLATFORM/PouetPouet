import { prisma } from '../../lib/prisma.js'
import { ldapClient } from '../../lib/ldap-client.js'
import type { RoleAchat } from '@prisma/client'

// ──────────────────────────────────────────────────────────────────────────────
// Circuit de validation des commandes — logique pure (pas de routes ici).
//
// La structure organisationnelle (nom, niveau, hiérarchie, manager "officiel") vit
// dans le pod LDAP externe (ldapClient, caché) ; seul le seuil d'approbation est
// propre à l'app (OrgUnitConfig). Chaque remontée d'arbre fusionne donc les deux
// sources au lieu d'une simple lecture Prisma.
//
// Construction de la chaîne (buildApprobationChain) :
//   • le niveau de rattachement de la commande est toujours sollicité (contrôle
//     de proximité systématique) ;
//   • tant que le niveau courant a un seuil dépassé par le montant, on remonte
//     au parent ;
//   • une étape Finance est toujours ajoutée en dernier (contrôle budgétaire).
//
// Autorisation à décider une étape HIERARCHIE (canDecideHierarchie) :
//   1. le manager "officiel" (LDAP) de l'OrgUnit est toujours autorisé ;
//   2. sinon, une délégation active (fenêtre de dates, COMPLET ou PARTIEL avec
//      plafond suffisant) ;
//   3. sinon, un ProfilAchat(VALIDEUR) assigné directement sur ce périmètre.
// ──────────────────────────────────────────────────────────────────────────────

export interface ChainStep {
  type: 'HIERARCHIE' | 'FINANCE'
  orgUnitId: string | null
}

async function seuilApprobation(orgUnitId: string): Promise<number | null> {
  const config = await prisma.orgUnitConfig.findUnique({ where: { id: orgUnitId } })
  return config?.seuilApprobation ?? null
}

export async function buildApprobationChain(orgUnitId: string, montant: number): Promise<ChainStep[]> {
  const steps: ChainStep[] = []
  const root = await ldapClient.getOrgUnit(orgUnitId)
  if (!root) throw new Error('Périmètre introuvable')
  steps.push({ type: 'HIERARCHIE', orgUnitId: root.id })

  let seuil = await seuilApprobation(root.id)
  let parentId = root.parentId
  while (seuil != null && montant > seuil && parentId) {
    const parent = await ldapClient.getOrgUnit(parentId)
    if (!parent) break
    steps.push({ type: 'HIERARCHIE', orgUnitId: parent.id })
    seuil = await seuilApprobation(parent.id)
    parentId = parent.parentId
  }

  steps.push({ type: 'FINANCE', orgUnitId: null })
  return steps
}

export async function canDecideHierarchie(userId: string, orgUnitId: string, montant: number): Promise<boolean> {
  const unit = await ldapClient.getOrgUnit(orgUnitId)
  if (!unit) return false
  const caller = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (unit.managerEmail && caller?.email && unit.managerEmail.toLowerCase() === caller.email.toLowerCase()) return true

  const now = new Date()
  const delegations = await prisma.delegationValidation.findMany({
    where: {
      delegueId: userId,
      orgUnitId,
      statut: 'ACTIVE',
      OR: [{ dateDebut: null }, { dateDebut: { lte: now } }],
    },
  })
  const seuil = await seuilApprobation(orgUnitId)
  for (const d of delegations) {
    if (d.dateFin && d.dateFin < now) continue
    if (d.pouvoir === 'COMPLET') return true
    const plafond = d.seuilEuro ?? (seuil != null && d.pourcentage != null ? seuil * d.pourcentage : null)
    if (plafond != null && montant <= plafond) return true
  }

  const profil = await prisma.profilAchat.findFirst({ where: { userId, role: 'VALIDEUR', orgUnitId } })
  return !!profil
}

export async function canDecideFinance(userId: string): Promise<boolean> {
  const profil = await prisma.profilAchat.findFirst({ where: { userId, role: 'FINANCE' } })
  return !!profil
}

export async function hasRole(userId: string, role: RoleAchat, orgUnitId?: string | null): Promise<boolean> {
  const count = await prisma.profilAchat.count({
    where: { userId, role, ...(orgUnitId !== undefined ? { orgUnitId } : {}) },
  })
  return count > 0
}

// Un valideur "titulaire" pour un OrgUnit : son manager LDAP, ou un ProfilAchat(VALIDEUR) direct.
// Sert à autoriser la création/révocation de délégations en self-service.
export async function isTitulaireValidation(userId: string, orgUnitId: string): Promise<boolean> {
  const unit = await ldapClient.getOrgUnit(orgUnitId)
  if (!unit) return false
  const caller = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (unit.managerEmail && caller?.email && unit.managerEmail.toLowerCase() === caller.email.toLowerCase()) return true
  return hasRole(userId, 'VALIDEUR', orgUnitId)
}
