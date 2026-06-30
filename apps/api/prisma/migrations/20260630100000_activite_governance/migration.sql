-- CreateEnum
CREATE TYPE "TypeActivite" AS ENUM ('REFONTE', 'RUN', 'NOUVEAU', 'EVOLUTION', 'MAINTENANCE', 'DECOMMISSIONNEMENT', 'AUTRE');

-- CreateEnum
CREATE TYPE "ActiviteStatut" AS ENUM ('ACTIF', 'CLOTURE', 'SUSPENDU');

-- CreateEnum
CREATE TYPE "Meteo" AS ENUM ('VERT', 'ORANGE', 'ROUGE', 'GRIS');

-- CreateEnum
CREATE TYPE "TypeLigneBudget" AS ENUM ('OPEX', 'CAPEX', 'APCO');

-- CreateEnum
CREATE TYPE "JalonType" AS ENUM ('A_ARRIVEE', 'B_ETUDE', 'C_REALISATION', 'D_DECLARATION_GAINS', 'E_DECOMMISSIONNEMENT', 'REVUE_PROJET', 'J7_MEP', 'J3_RECETTE', 'COMITE_TECHNIQUE', 'COMITE_ARCHITECTURE', 'COMITE_CADRAGE', 'AUTRE');

-- CreateEnum
CREATE TYPE "RisqueStatut" AS ENUM ('OUVERT', 'EN_COURS', 'CLOS');

-- DropForeignKey
ALTER TABLE "DemandeAchat" DROP CONSTRAINT "DemandeAchat_projetId_fkey";

-- DropForeignKey
ALTER TABLE "Projet" DROP CONSTRAINT "Projet_ownerId_fkey";

-- AlterTable
ALTER TABLE "DemandeAchat" DROP COLUMN "projetId",
ADD COLUMN     "activiteId" TEXT;

-- DropTable
DROP TABLE "Projet";

-- DropEnum
DROP TYPE "ProjetStatut";

-- CreateTable
CREATE TABLE "Activite" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" "TypeActivite" NOT NULL DEFAULT 'AUTRE',
    "statut" "ActiviteStatut" NOT NULL DEFAULT 'ACTIF',
    "meteo" "Meteo" NOT NULL DEFAULT 'GRIS',
    "description" TEXT,
    "enjeux" BOOLEAN NOT NULL DEFAULT false,
    "pmt" TEXT,
    "planProduction" BOOLEAN NOT NULL DEFAULT false,
    "schemaDirecteur" BOOLEAN NOT NULL DEFAULT false,
    "hopexLien" TEXT,
    "piloteId" TEXT,
    "produitId" TEXT,
    "departementId" TEXT,
    "pole" TEXT,
    "domaineMetier" TEXT,
    "sousDomaineMetier" TEXT,
    "capaciteMetier" TEXT,
    "sousCapaciteMetier" TEXT,
    "prioriteMetier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produit" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiviteGain" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "typologie" TEXT NOT NULL,
    "commentaire" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ActiviteGain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiviteFaitMarquant" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "texte" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiviteFaitMarquant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiviteBudgetLigne" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "annee" INTEGER NOT NULL,
    "type" "TypeLigneBudget" NOT NULL,
    "montantMo" DOUBLE PRECISION,
    "montantHmo" DOUBLE PRECISION,
    "utilisateurMetier" TEXT,
    "priorite" TEXT,
    "objetGestion" TEXT,
    "jalonPhase" "JalonType",
    "contratId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiviteBudgetLigne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiviteJalon" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "type" "JalonType" NOT NULL,
    "libelle" TEXT,
    "datePrevue" TIMESTAMP(3),
    "dateReelle" TIMESTAMP(3),
    "decision" TEXT,
    "commentaire" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ActiviteJalon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiviteRisque" (
    "id" TEXT NOT NULL,
    "activiteId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "categorie" TEXT,
    "probabilite" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "planMitigation" TEXT,
    "responsable" TEXT,
    "jiraLien" TEXT,
    "statut" "RisqueStatut" NOT NULL DEFAULT 'OUVERT',
    "dateIdentification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateRevue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiviteRisque_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_piloteId_fkey" FOREIGN KEY ("piloteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activite" ADD CONSTRAINT "Activite_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiviteGain" ADD CONSTRAINT "ActiviteGain_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiviteFaitMarquant" ADD CONSTRAINT "ActiviteFaitMarquant_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiviteBudgetLigne" ADD CONSTRAINT "ActiviteBudgetLigne_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiviteBudgetLigne" ADD CONSTRAINT "ActiviteBudgetLigne_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiviteJalon" ADD CONSTRAINT "ActiviteJalon_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiviteRisque" ADD CONSTRAINT "ActiviteRisque_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAchat" ADD CONSTRAINT "DemandeAchat_activiteId_fkey" FOREIGN KEY ("activiteId") REFERENCES "Activite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

