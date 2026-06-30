import { prisma } from '../../lib/prisma.js'
import { ldapClient } from '../../lib/ldap-client.js'

export type Champ = 'TYPE_LIGNE_BUDGET' | 'JALON_TYPE' | 'TYPE_ACTIVITE'

export interface GovernanceValue {
  valeur: string
  actif: boolean
  obligatoire: boolean
}

const TYPE_LIGNE_BUDGET_VALUES = ['OPEX', 'CAPEX', 'APCO'] as const
const JALON_TYPE_VALUES = [
  'A_ARRIVEE', 'B_ETUDE', 'C_REALISATION', 'D_DECLARATION_GAINS', 'E_DECOMMISSIONNEMENT',
  'REVUE_PROJET', 'J7_MEP', 'J3_RECETTE', 'COMITE_TECHNIQUE', 'COMITE_ARCHITECTURE', 'COMITE_CADRAGE', 'AUTRE',
] as const
// Les 8 premiers correspondent aux jalons PMPG fixes historiques (cf. JALONS_FIXES
// dans activite.routes.ts) — défaut non régressif tant qu'aucune GovernanceConfig
// n'est définie pour un OrgUnit donné.
const JALON_TYPE_OBLIGATOIRES_DEFAUT = new Set([
  'A_ARRIVEE', 'B_ETUDE', 'C_REALISATION', 'D_DECLARATION_GAINS',
  'E_DECOMMISSIONNEMENT', 'REVUE_PROJET', 'J7_MEP', 'J3_RECETTE',
])
const TYPE_ACTIVITE_VALUES = ['REFONTE', 'RUN', 'NOUVEAU', 'EVOLUTION', 'MAINTENANCE', 'DECOMMISSIONNEMENT', 'AUTRE'] as const

export const ALL_VALUES: Record<Champ, readonly string[]> = {
  TYPE_LIGNE_BUDGET: TYPE_LIGNE_BUDGET_VALUES,
  JALON_TYPE: JALON_TYPE_VALUES,
  TYPE_ACTIVITE: TYPE_ACTIVITE_VALUES,
}

function defaultValues(champ: Champ): GovernanceValue[] {
  return ALL_VALUES[champ].map((valeur) => ({
    valeur,
    actif: true,
    obligatoire: champ === 'JALON_TYPE' ? JALON_TYPE_OBLIGATOIRES_DEFAUT.has(valeur) : false,
  }))
}

// Remonte l'arbre OrgUnit (inclusif) jusqu'au premier niveau qui a au moins une ligne
// de GovernanceConfig pour ce champ. "Avoir une config" = avoir au moins une ligne
// (active ou non) — un admin qui veut exclure une valeur doit définir le jeu complet
// voulu pour son niveau (l'UI d'admin pré-remplit toutes les valeurs à la sauvegarde,
// cf. governance-config.routes.ts). La structure (parentId/nom) vient du pod LDAP
// externe (ldapClient, caché) — seules les lignes GovernanceConfig sont locales.
async function findNearestConfig(orgUnitId: string, champ: Champ) {
  let current = await ldapClient.getOrgUnit(orgUnitId)
  let isLocal = true
  while (current) {
    const rows = await prisma.governanceConfig.findMany({ where: { orgUnitId: current.id, champ }, orderBy: { ordre: 'asc' } })
    if (rows.length > 0) {
      return { rows, source: (isLocal ? 'local' : 'herite') as 'local' | 'herite', sourceOrgUnitNom: isLocal ? undefined : current.nom }
    }
    if (!current.parentId) return null
    current = await ldapClient.getOrgUnit(current.parentId)
    isLocal = false
  }
  return null
}

// Liste résolue (uniquement les valeurs actives), utilisée par les formulaires
// (sélecteurs de type de ligne budgétaire / type d'activité, génération des jalons
// obligatoires à la création d'une activité).
export async function resolveGovernanceConfig(orgUnitId: string | null | undefined, champ: Champ): Promise<GovernanceValue[]> {
  if (!orgUnitId) return defaultValues(champ)
  const found = await findNearestConfig(orgUnitId, champ)
  if (!found) return defaultValues(champ)
  return found.rows.filter((r) => r.actif).map((r) => ({ valeur: r.valeur, actif: r.actif, obligatoire: r.obligatoire }))
}

export interface GovernanceEtatValue extends GovernanceValue {
  source: 'local' | 'herite' | 'defaut'
  sourceOrgUnitNom?: string
}

// Vue complète (toutes les valeurs possibles, actives ou non, avec leur provenance),
// utilisée par la page d'administration pour afficher "défini ici" / "hérité de X" / "défaut".
export async function resolveGovernanceEtat(orgUnitId: string, champ: Champ): Promise<GovernanceEtatValue[]> {
  const found = await findNearestConfig(orgUnitId, champ)
  if (!found) return defaultValues(champ).map((v) => ({ ...v, source: 'defaut' as const }))
  return found.rows.map((r) => ({
    valeur: r.valeur, actif: r.actif, obligatoire: r.obligatoire,
    source: found.source, sourceOrgUnitNom: found.sourceOrgUnitNom,
  }))
}
