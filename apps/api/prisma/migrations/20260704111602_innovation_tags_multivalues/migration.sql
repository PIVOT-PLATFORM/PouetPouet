/*
  Warnings:

  - You are about to drop the column `categoryId` on the `InnovationFiche` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "InnovationFiche" DROP CONSTRAINT "InnovationFiche_categoryId_fkey";

-- DropIndex
DROP INDEX "InnovationFiche_categoryId_idx";

-- AlterTable
ALTER TABLE "InnovationFiche" DROP COLUMN "categoryId";

-- CreateTable
CREATE TABLE "InnovationFicheCategory" (
    "ficheId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "InnovationFicheCategory_pkey" PRIMARY KEY ("ficheId","categoryId")
);

-- CreateIndex
CREATE INDEX "InnovationFicheCategory_categoryId_idx" ON "InnovationFicheCategory"("categoryId");

-- AddForeignKey
ALTER TABLE "InnovationFicheCategory" ADD CONSTRAINT "InnovationFicheCategory_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "InnovationFiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InnovationFicheCategory" ADD CONSTRAINT "InnovationFicheCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InnovationCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
