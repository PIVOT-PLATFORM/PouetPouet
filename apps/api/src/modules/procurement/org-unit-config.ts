import { prisma } from '../../lib/prisma.js'

// La structure organisationnelle vit dans le pod LDAP externe (ldapClient) — cette
// table ne fait qu'étendre une unité organisationnelle externe avec ce que l'app gère
// réellement (seuil d'approbation). Toute table qui rattache une FK à OrgUnitConfig
// (ProfilAchat, DelegationValidation, GovernanceConfig, DemandeAchatWorkflow,
// Activite.departementId) doit d'abord garantir que la ligne existe — sinon la FK
// échoue puisque rien ne crée automatiquement OrgUnitConfig quand le LDAP renvoie une
// unité encore jamais référencée côté app.
export async function ensureOrgUnitConfig(orgUnitId: string, ownerId: string): Promise<void> {
  await prisma.orgUnitConfig.upsert({
    where: { id: orgUnitId },
    create: { id: orgUnitId, ownerId },
    update: {},
  })
}
