-- CreateEnum
CREATE TYPE "ChampConfigurable" AS ENUM ('TYPE_LIGNE_BUDGET', 'JALON_TYPE', 'TYPE_ACTIVITE');

-- CreateTable
CREATE TABLE "GovernanceConfig" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "orgUnitId" TEXT NOT NULL,
    "champ" "ChampConfigurable" NOT NULL,
    "valeur" TEXT NOT NULL,
    "obligatoire" BOOLEAN NOT NULL DEFAULT false,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceConfig_orgUnitId_champ_valeur_key" ON "GovernanceConfig"("orgUnitId", "champ", "valeur");

-- AddForeignKey
ALTER TABLE "GovernanceConfig" ADD CONSTRAINT "GovernanceConfig_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceConfig" ADD CONSTRAINT "GovernanceConfig_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
