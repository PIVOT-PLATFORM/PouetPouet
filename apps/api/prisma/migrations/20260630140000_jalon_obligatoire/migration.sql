-- AlterTable
ALTER TABLE "ActiviteJalon" ADD COLUMN     "obligatoire" BOOLEAN NOT NULL DEFAULT false;

-- Backfill : les jalons PMPG fixes déjà créés avant ce changement (cf. ancien
-- JALONS_FIXES en dur dans activite.routes.ts) restent protégés contre la suppression.
UPDATE "ActiviteJalon" SET "obligatoire" = true
WHERE "type" IN ('A_ARRIVEE', 'B_ETUDE', 'C_REALISATION', 'D_DECLARATION_GAINS', 'E_DECOMMISSIONNEMENT', 'REVUE_PROJET', 'J7_MEP', 'J3_RECETTE');
