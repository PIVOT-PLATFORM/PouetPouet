-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'OPEN', 'EVALUATION', 'CLOSED');

-- CreateTable
CREATE TABLE "InnovationChallenge" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "theme" TEXT,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "ownerId" TEXT NOT NULL,
    "orgUnitRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InnovationChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeEntry" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InnovationChallenge_ownerId_idx" ON "InnovationChallenge"("ownerId");

-- CreateIndex
CREATE INDEX "InnovationChallenge_status_idx" ON "InnovationChallenge"("status");

-- CreateIndex
CREATE INDEX "ChallengeEntry_ficheId_idx" ON "ChallengeEntry"("ficheId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEntry_challengeId_ficheId_key" ON "ChallengeEntry"("challengeId", "ficheId");

-- AddForeignKey
ALTER TABLE "InnovationChallenge" ADD CONSTRAINT "InnovationChallenge_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "InnovationChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "InnovationFiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
