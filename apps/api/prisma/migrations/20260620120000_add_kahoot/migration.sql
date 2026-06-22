-- CreateEnum
CREATE TYPE "KahootStatus" AS ENUM ('LOBBY', 'QUESTION', 'REVEAL', 'LEADERBOARD', 'ENDED');

-- CreateTable
CREATE TABLE "KahootQuiz" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KahootQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KahootQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correct" INTEGER NOT NULL,
    "timeLimit" INTEGER NOT NULL DEFAULT 30,
    "points" INTEGER NOT NULL DEFAULT 1000,
    "order" INTEGER NOT NULL,

    CONSTRAINT "KahootQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KahootSession" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "KahootStatus" NOT NULL DEFAULT 'LOBBY',
    "currentQuestion" INTEGER NOT NULL DEFAULT 0,
    "questionEndAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KahootSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KahootParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KahootParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KahootAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "responseMs" INTEGER NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KahootAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KahootSession_code_key" ON "KahootSession"("code");

-- CreateIndex
CREATE UNIQUE INDEX "KahootParticipant_sessionId_name_key" ON "KahootParticipant"("sessionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "KahootAnswer_sessionId_questionId_participantId_key" ON "KahootAnswer"("sessionId", "questionId", "participantId");

-- AddForeignKey
ALTER TABLE "KahootQuiz" ADD CONSTRAINT "KahootQuiz_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KahootQuestion" ADD CONSTRAINT "KahootQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "KahootQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KahootSession" ADD CONSTRAINT "KahootSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "KahootQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KahootSession" ADD CONSTRAINT "KahootSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KahootParticipant" ADD CONSTRAINT "KahootParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "KahootSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KahootAnswer" ADD CONSTRAINT "KahootAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "KahootSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KahootAnswer" ADD CONSTRAINT "KahootAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "KahootQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KahootAnswer" ADD CONSTRAINT "KahootAnswer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "KahootParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
