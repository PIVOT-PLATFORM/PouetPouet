-- CreateEnum
CREATE TYPE "InnovationVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- AlterTable
ALTER TABLE "InnovationFiche" ADD COLUMN     "visibility" "InnovationVisibility" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "InnovationFavorite" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "InnovationFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InnovationFavorite_userId_idx" ON "InnovationFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InnovationFavorite_ficheId_userId_key" ON "InnovationFavorite"("ficheId", "userId");

-- AddForeignKey
ALTER TABLE "InnovationFavorite" ADD CONSTRAINT "InnovationFavorite_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "InnovationFiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InnovationFavorite" ADD CONSTRAINT "InnovationFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
