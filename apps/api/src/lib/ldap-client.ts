import { createExternalServiceClient } from './external-client.js'

export type OrgUnitNiveau = 'EQUIPE' | 'DEPARTEMENT' | 'DIVISION' | 'DIRECTION' | 'COMEX'

export interface LdapOrgUnit {
  id: string
  nom: string
  niveau: OrgUnitNiveau
  parentId: string | null
  managerEmail: string | null
  managerName: string | null
}

const client = createExternalServiceClient({ baseUrlEnv: 'LDAP_API_URL', defaultTtlSeconds: 60 })

export const ldapClient = {
  listOrgUnits() {
    return client.get<LdapOrgUnit[]>('/org-units', 60)
  },
  getOrgUnit(id: string) {
    return client.getOrNull<LdapOrgUnit>(`/org-units/${id}`, 60)
  },
}
