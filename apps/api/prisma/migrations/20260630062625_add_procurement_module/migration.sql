-- CreateEnum
CREATE TYPE "ContratStatut" AS ENUM ('ACTIF', 'EXPIRE', 'RESILIE');

-- CreateEnum
CREATE TYPE "CommandeStatut" AS ENUM ('EN_COURS', 'LIVREE', 'SOLDEE');

-- CreateTable
CREATE TABLE "Contrat" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "statut" "ContratStatut" NOT NULL DEFAULT 'ACTIF',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contrat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratLot" (
    "id" TEXT NOT NULL,
    "contratId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "intitule" TEXT NOT NULL,
    "titulaire" TEXT,
    "montantMax" DOUBLE PRECISION,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ContratLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commande" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "dateCommande" TIMESTAMP(3) NOT NULL,
    "statut" "CommandeStatut" NOT NULL DEFAULT 'EN_COURS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandeLot" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "contratLotId" TEXT,
    "intitule" TEXT NOT NULL,
    "titulaire" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CommandeLot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Contrat" ADD CONSTRAINT "Contrat_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContratLot" ADD CONSTRAINT "ContratLot_contratId_fkey" FOREIGN KEY ("contratId") REFERENCES "Contrat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeLot" ADD CONSTRAINT "CommandeLot_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "Commande"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeLot" ADD CONSTRAINT "CommandeLot_contratLotId_fkey" FOREIGN KEY ("contratLotId") REFERENCES "ContratLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
