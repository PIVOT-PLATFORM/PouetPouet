-- CreateEnum
CREATE TYPE "InnovationOrgNiveau" AS ENUM ('COMEX', 'DIRECTION', 'DIVISION', 'DEPARTEMENT', 'EQUIPE');

-- AlterTable
ALTER TABLE "InnovationFiche" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "InnovationOrgUnit" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "niveau" "InnovationOrgNiveau" NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InnovationOrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InnovationCategory" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "orgUnitRef" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InnovationCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InnovationOrgUnit_parentId_idx" ON "InnovationOrgUnit"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "InnovationCategory_label_orgUnitRef_key" ON "InnovationCategory"("label", "orgUnitRef");

-- CreateIndex
CREATE INDEX "InnovationFiche_categoryId_idx" ON "InnovationFiche"("categoryId");

-- AddForeignKey
ALTER TABLE "InnovationFiche" ADD CONSTRAINT "InnovationFiche_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InnovationCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InnovationOrgUnit" ADD CONSTRAINT "InnovationOrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "InnovationOrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
