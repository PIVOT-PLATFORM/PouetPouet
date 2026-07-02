-- Externalisation PGI (Contrat/ContratLot/Commande/DemandeAchat/DemandeAchatLot) et
-- LDAP (OrgUnit) vers les pods mock apps/pgi-mock et apps/ldap-mock. Migration
-- destructive : pas de chemin de conservation pour les données existantes (elles
-- référencent des entités qui disparaissent du schéma) — données de test recréées par
-- un reseed juste après cette migration.

-- ── Nettoyage pré-migration ───────────────────────────────────────────────────────
DELETE FROM "CommandeApprobation";
DELETE FROM "GovernanceConfig";
DELETE FROM "DelegationValidation";
DELETE FROM "ProfilAchat";
UPDATE "Activite" SET "departementId" = NULL;
UPDATE "ActiviteBudgetLigne" SET "contratId" = NULL;

-- ── Tables externalisées (CASCADE nettoie les FK dépendantes) ────────────────────
DROP TABLE "Commande" CASCADE;
DROP TABLE "ContratLot" CASCADE;
DROP TABLE "Contrat" CASCADE;
DROP TABLE "DemandeAchatLot" CASCADE;
DROP TABLE "DemandeAchat" CASCADE;
DROP TABLE "OrgUnit" CASCADE;

DROP TYPE "ContratStatut";
DROP TYPE "CommandeStatut";
DROP TYPE "OrgUnitNiveau";

-- ── ValidationStatut recréé sans BROUILLON (plus aucune donnée ne le référence) ───
DROP TYPE "ValidationStatut";
CREATE TYPE "ValidationStatut" AS ENUM ('EN_VALIDATION', 'VALIDEE', 'REJETEE');

-- ── Nouvelles tables ──────────────────────────────────────────────────────────────
CREATE TABLE "OrgUnitConfig" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "seuilApprobation" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUnitConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DemandeAchatWorkflow" (
    "id" TEXT NOT NULL,
    "demandeAchatExternalId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "activiteId" TEXT,
    "validationStatut" "ValidationStatut" NOT NULL DEFAULT 'EN_VALIDATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeAchatWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemandeAchatWorkflow_demandeAchatExternalId_key" ON "DemandeAchatWorkflow"("demandeAchatExternalId");

-- ── Nouvelles FK ──────────────────────────────────────────────────────────────────
ALTER TABLE "OrgUnitConfig" ADD CONSTRAINT "OrgUnitConfig_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DemandeAchatWorkflow" ADD CONSTRAINT "DemandeAchatWorkflow_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemandeAchatWorkflow" ADD CONSTRAINT "DemandeAchatWorkflow_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnitConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemandeAchatWorkflow" ADD CONSTRAINT "DemandeAchatWorkflow_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Activite" ADD CONSTRAINT "Activite_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "OrgUnitConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GovernanceConfig" ADD CONSTRAINT "GovernanceConfig_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnitConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfilAchat" ADD CONSTRAINT "ProfilAchat_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnitConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DelegationValidation" ADD CONSTRAINT "DelegationValidation_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnitConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CommandeApprobation" RENAME COLUMN "demandeAchatId" TO "demandeAchatWorkflowId";
ALTER TABLE "CommandeApprobation" ADD CONSTRAINT "CommandeApprobation_demandeAchatWorkflowId_fkey" FOREIGN KEY ("demandeAchatWorkflowId") REFERENCES "DemandeAchatWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommandeApprobation" ADD CONSTRAINT "CommandeApprobation_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnitConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
