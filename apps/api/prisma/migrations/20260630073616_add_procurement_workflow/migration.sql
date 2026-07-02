-- CreateEnum
CREATE TYPE "ProjetStatut" AS ENUM ('ACTIF', 'CLOTURE');

-- CreateEnum
CREATE TYPE "ValidationStatut" AS ENUM ('BROUILLON', 'EN_VALIDATION', 'VALIDEE', 'REJETEE');

-- CreateEnum
CREATE TYPE "OrgUnitNiveau" AS ENUM ('EQUIPE', 'DEPARTEMENT', 'DIVISION', 'DIRECTION', 'COMEX');

-- CreateEnum
CREATE TYPE "RoleAchat" AS ENUM ('CHEF_DE_PROJET', 'VALIDEUR', 'FINANCE', 'CONTRACT_MANAGER');

-- CreateEnum
CREATE TYPE "PouvoirDelegation" AS ENUM ('COMPLET', 'PARTIEL');

-- CreateEnum
CREATE TYPE "StatutDelegation" AS ENUM ('ACTIVE', 'REVOQUEE');

-- CreateEnum
CREATE TYPE "ApprobationType" AS ENUM ('HIERARCHIE', 'FINANCE');

-- CreateEnum
CREATE TYPE "StatutApprobation" AS ENUM ('EN_ATTENTE', 'APPROUVEE', 'REJETEE');

-- AlterTable
ALTER TABLE "Commande" ADD COLUMN     "orgUnitId" TEXT,
ADD COLUMN     "projetId" TEXT,
ADD COLUMN     "referencePgi" TEXT,
ADD COLUMN     "validationStatut" "ValidationStatut" NOT NULL DEFAULT 'BROUILLON';

-- AlterTable
ALTER TABLE "Contrat" ADD COLUMN     "referencePgi" TEXT;

-- CreateTable
CREATE TABLE "Projet" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "enveloppe" DOUBLE PRECISION,
    "statut" "ProjetStatut" NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Projet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "niveau" "OrgUnitNiveau" NOT NULL,
    "parentId" TEXT,
    "managerId" TEXT,
    "seuilApprobation" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfilAchat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoleAchat" NOT NULL,
    "orgUnitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfilAchat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelegationValidation" (
    "id" TEXT NOT NULL,
    "delegantId" TEXT NOT NULL,
    "delegueId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "pouvoir" "PouvoirDelegation" NOT NULL,
    "pourcentage" DOUBLE PRECISION,
    "seuilEuro" DOUBLE PRECISION,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "statut" "StatutDelegation" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegationValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeApprobation" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "ApprobationType" NOT NULL,
    "orgUnitId" TEXT,
    "statut" "StatutApprobation" NOT NULL DEFAULT 'EN_ATTENTE',
    "validateurId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandeApprobation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfilAchat_userId_role_orgUnitId_key" ON "ProfilAchat"("userId", "role", "orgUnitId");

-- AddForeignKey
ALTER TABLE "Projet" ADD CONSTRAINT "Projet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilAchat" ADD CONSTRAINT "ProfilAchat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfilAchat" ADD CONSTRAINT "ProfilAchat_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegationValidation" ADD CONSTRAINT "DelegationValidation_delegantId_fkey" FOREIGN KEY ("delegantId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegationValidation" ADD CONSTRAINT "DelegationValidation_delegueId_fkey" FOREIGN KEY ("delegueId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegationValidation" ADD CONSTRAINT "DelegationValidation_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeApprobation" ADD CONSTRAINT "CommandeApprobation_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeApprobation" ADD CONSTRAINT "CommandeApprobation_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeApprobation" ADD CONSTRAINT "CommandeApprobation_validateurId_fkey" FOREIGN KEY ("validateurId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
