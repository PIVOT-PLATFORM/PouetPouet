-- CreateEnum
CREATE TYPE "RoadmapItemStatus" AS ENUM ('TODO', 'DOING', 'BLOCKED', 'DONE');

-- AlterTable
ALTER TABLE "Roadmap" ADD COLUMN     "portfolioId" TEXT;

-- AlterTable
ALTER TABLE "RoadmapItem" ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "status" "RoadmapItemStatus" NOT NULL DEFAULT 'TODO';

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Portfolio_ownerId_idx" ON "Portfolio"("ownerId");

-- CreateIndex
CREATE INDEX "Roadmap_portfolioId_idx" ON "Roadmap"("portfolioId");

-- CreateIndex
CREATE INDEX "RoadmapItem_assigneeId_idx" ON "RoadmapItem"("assigneeId");

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
