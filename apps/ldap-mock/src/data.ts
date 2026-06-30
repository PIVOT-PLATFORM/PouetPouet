import { randomUUID } from 'node:crypto'

export type OrgUnitNiveau = 'EQUIPE' | 'DEPARTEMENT' | 'DIVISION' | 'DIRECTION' | 'COMEX'

// Reflet d'un annuaire LDAP/OIDC : structure organisationnelle + manager "officiel"
// (informatif). Octroyer un pouvoir de validation dans l'app reste un acte distinct,
// géré côté app via ProfilAchat — ce pod ne connaît rien des droits applicatifs.
export interface OrgUnit {
  id: string
  nom: string
  niveau: OrgUnitNiveau
  parentId: string | null
  managerEmail: string | null
  managerName: string | null
}

export function generateOrgUnits(): OrgUnit[] {
  const comex: OrgUnit = { id: randomUUID(), nom: 'COMEX', niveau: 'COMEX', parentId: null, managerEmail: null, managerName: null }
  const direction: OrgUnit = { id: randomUUID(), nom: 'Direction SI', niveau: 'DIRECTION', parentId: comex.id, managerEmail: 'manager.direction@demo-pgi.local', managerName: 'Camille Directeur' }
  const division: OrgUnit = { id: randomUUID(), nom: 'Division Technologie', niveau: 'DIVISION', parentId: direction.id, managerEmail: 'manager.division@demo-pgi.local', managerName: 'Sacha Division' }
  const departement: OrgUnit = { id: randomUUID(), nom: 'Département Dév Informatique', niveau: 'DEPARTEMENT', parentId: division.id, managerEmail: 'manager.departement@demo-pgi.local', managerName: 'Dominique Département' }
  const equipeBackend: OrgUnit = { id: randomUUID(), nom: 'Équipe Backend', niveau: 'EQUIPE', parentId: departement.id, managerEmail: 'manager.equipe@demo-pgi.local', managerName: 'Robin Manager' }
  const equipeFrontend: OrgUnit = { id: randomUUID(), nom: 'Équipe Frontend', niveau: 'EQUIPE', parentId: departement.id, managerEmail: 'manager.equipe@demo-pgi.local', managerName: 'Robin Manager' }
  return [comex, direction, division, departement, equipeBackend, equipeFrontend]
}
