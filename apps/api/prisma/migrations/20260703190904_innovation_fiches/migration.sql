-- CreateEnum
CREATE TYPE "InnovationStatus" AS ENUM ('IDEE', 'EXPLORATION', 'ADOPTEE', 'ABANDONNEE');

-- CreateTable
CREATE TABLE "InnovationFiche" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pitch" TEXT NOT NULL,
    "probleme" TEXT,
    "solution" TEXT,
    "benefices" TEXT,
    "status" "InnovationStatus" NOT NULL DEFAULT 'IDEE',
    "abandonReason" TEXT,
    "authorId" TEXT NOT NULL,
    "orgUnitRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InnovationFiche_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InnovationContributor" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InnovationContributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InnovationVote" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "InnovationVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InnovationFiche_authorId_idx" ON "InnovationFiche"("authorId");

-- CreateIndex
CREATE INDEX "InnovationFiche_status_idx" ON "InnovationFiche"("status");

-- CreateIndex
CREATE INDEX "InnovationContributor_userId_idx" ON "InnovationContributor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InnovationContributor_ficheId_userId_key" ON "InnovationContributor"("ficheId", "userId");

-- CreateIndex
CREATE INDEX "InnovationVote_userId_idx" ON "InnovationVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InnovationVote_ficheId_userId_key" ON "InnovationVote"("ficheId", "userId");

-- AddForeignKey
ALTER TABLE "InnovationFiche" ADD CONSTRAINT "InnovationFiche_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InnovationContributor" ADD CONSTRAINT "InnovationContributor_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "InnovationFiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InnovationContributor" ADD CONSTRAINT "InnovationContributor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InnovationVote" ADD CONSTRAINT "InnovationVote_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "InnovationFiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InnovationVote" ADD CONSTRAINT "InnovationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
