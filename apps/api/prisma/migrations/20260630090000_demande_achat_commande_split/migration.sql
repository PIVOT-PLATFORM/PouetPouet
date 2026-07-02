-- DropForeignKey
ALTER TABLE "Commande" DROP CONSTRAINT "Commande_orgUnitId_fkey";

-- DropForeignKey
ALTER TABLE "Commande" DROP CONSTRAINT "Commande_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Commande" DROP CONSTRAINT "Commande_projetId_fkey";

-- DropForeignKey
ALTER TABLE "CommandeApprobation" DROP CONSTRAINT "CommandeApprobation_commandeId_fkey";

-- DropForeignKey
ALTER TABLE "CommandeLot" DROP CONSTRAINT "CommandeLot_commandeId_fkey";

-- DropForeignKey
ALTER TABLE "CommandeLot" DROP CONSTRAINT "CommandeLot_contratLotId_fkey";

-- AlterTable
ALTER TABLE "Commande" DROP COLUMN "dateCommande",
DROP COLUMN "notes",
DROP COLUMN "objet",
DROP COLUMN "orgUnitId",
DROP COLUMN "ownerId",
DROP COLUMN "projetId",
DROP COLUMN "validationStatut",
ADD COLUMN     "dateEmission" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "demandeAchatId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CommandeApprobation" DROP COLUMN "commandeId",
ADD COLUMN     "demandeAchatId" TEXT NOT NULL;

-- DropTable
DROP TABLE "CommandeLot";

-- CreateTable
CREATE TABLE "DemandeAchat" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "objet" TEXT NOT NULL,
    "dateDemande" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "projetId" TEXT,
    "orgUnitId" TEXT,
    "validationStatut" "ValidationStatut" NOT NULL DEFAULT 'BROUILLON',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeAchat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeAchatLot" (
    "id" TEXT NOT NULL,
    "demandeAchatId" TEXT NOT NULL,
    "contratLotId" TEXT,
    "intitule" TEXT NOT NULL,
    "titulaire" TEXT,
    "montant" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DemandeAchatLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Commande_demandeAchatId_key" ON "Commande"("demandeAchatId");

-- AddForeignKey
ALTER TABLE "DemandeAchat" ADD CONSTRAINT "DemandeAchat_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAchat" ADD CONSTRAINT "DemandeAchat_projetId_fkey" FOREIGN KEY ("projetId") REFERENCES "Projet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAchat" ADD CONSTRAINT "DemandeAchat_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAchatLot" ADD CONSTRAINT "DemandeAchatLot_demandeAchatId_fkey" FOREIGN KEY ("demandeAchatId") REFERENCES "DemandeAchat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeAchatLot" ADD CONSTRAINT "DemandeAchatLot_contratLotId_fkey" FOREIGN KEY ("contratLotId") REFERENCES "ContratLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commande" ADD CONSTRAINT "Commande_demandeAchatId_fkey" FOREIGN KEY ("demandeAchatId") REFERENCES "DemandeAchat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeApprobation" ADD CONSTRAINT "CommandeApprobation_demandeAchatId_fkey" FOREIGN KEY ("demandeAchatId") REFERENCES "DemandeAchat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
