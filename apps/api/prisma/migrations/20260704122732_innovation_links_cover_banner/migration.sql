-- AlterTable
ALTER TABLE "InnovationFiche" ADD COLUMN     "bannerImage" TEXT,
ADD COLUMN     "coverImage" TEXT;

-- CreateTable
CREATE TABLE "InnovationLink" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InnovationLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InnovationLink_ficheId_idx" ON "InnovationLink"("ficheId");

-- AddForeignKey
ALTER TABLE "InnovationLink" ADD CONSTRAINT "InnovationLink_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "InnovationFiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;
