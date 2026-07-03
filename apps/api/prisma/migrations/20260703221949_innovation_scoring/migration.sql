-- CreateTable
CREATE TABLE "ChallengeCriterion" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "poids" INTEGER NOT NULL DEFAULT 1,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeJuror" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeJuror_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeScore" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "jurorId" TEXT NOT NULL,
    "note" INTEGER NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChallengeCriterion_challengeId_idx" ON "ChallengeCriterion"("challengeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeJuror_challengeId_userId_key" ON "ChallengeJuror"("challengeId", "userId");

-- CreateIndex
CREATE INDEX "ChallengeScore_entryId_idx" ON "ChallengeScore"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeScore_entryId_criterionId_jurorId_key" ON "ChallengeScore"("entryId", "criterionId", "jurorId");

-- AddForeignKey
ALTER TABLE "ChallengeCriterion" ADD CONSTRAINT "ChallengeCriterion_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "InnovationChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeJuror" ADD CONSTRAINT "ChallengeJuror_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "InnovationChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeJuror" ADD CONSTRAINT "ChallengeJuror_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeScore" ADD CONSTRAINT "ChallengeScore_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ChallengeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeScore" ADD CONSTRAINT "ChallengeScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ChallengeCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeScore" ADD CONSTRAINT "ChallengeScore_jurorId_fkey" FOREIGN KEY ("jurorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
