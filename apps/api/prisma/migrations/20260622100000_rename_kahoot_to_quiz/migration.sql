-- Rename Kahoot tables and enum to Quiz (copyright-free naming)

ALTER TABLE "KahootQuiz" RENAME TO "Quiz";
ALTER TABLE "KahootQuestion" RENAME TO "QuizQuestion";
ALTER TABLE "KahootSession" RENAME TO "QuizSession";
ALTER TABLE "KahootParticipant" RENAME TO "QuizParticipant";
ALTER TABLE "KahootAnswer" RENAME TO "QuizAnswer";

-- Rename primary key constraints
ALTER TABLE "Quiz" RENAME CONSTRAINT "KahootQuiz_pkey" TO "Quiz_pkey";
ALTER TABLE "QuizQuestion" RENAME CONSTRAINT "KahootQuestion_pkey" TO "QuizQuestion_pkey";
ALTER TABLE "QuizSession" RENAME CONSTRAINT "KahootSession_pkey" TO "QuizSession_pkey";
ALTER TABLE "QuizParticipant" RENAME CONSTRAINT "KahootParticipant_pkey" TO "QuizParticipant_pkey";
ALTER TABLE "QuizAnswer" RENAME CONSTRAINT "KahootAnswer_pkey" TO "QuizAnswer_pkey";

-- Rename unique indexes (created with CREATE UNIQUE INDEX, not ADD CONSTRAINT UNIQUE)
ALTER INDEX "KahootSession_code_key" RENAME TO "QuizSession_code_key";
ALTER INDEX "KahootParticipant_sessionId_name_key" RENAME TO "QuizParticipant_sessionId_name_key";
ALTER INDEX "KahootAnswer_sessionId_questionId_participantId_key" RENAME TO "QuizAnswer_sessionId_questionId_participantId_key";

-- Rename foreign key constraints
ALTER TABLE "Quiz" RENAME CONSTRAINT "KahootQuiz_ownerId_fkey" TO "Quiz_ownerId_fkey";
ALTER TABLE "QuizQuestion" RENAME CONSTRAINT "KahootQuestion_quizId_fkey" TO "QuizQuestion_quizId_fkey";
ALTER TABLE "QuizSession" RENAME CONSTRAINT "KahootSession_quizId_fkey" TO "QuizSession_quizId_fkey";
ALTER TABLE "QuizSession" RENAME CONSTRAINT "KahootSession_ownerId_fkey" TO "QuizSession_ownerId_fkey";
ALTER TABLE "QuizParticipant" RENAME CONSTRAINT "KahootParticipant_sessionId_fkey" TO "QuizParticipant_sessionId_fkey";
ALTER TABLE "QuizAnswer" RENAME CONSTRAINT "KahootAnswer_sessionId_fkey" TO "QuizAnswer_sessionId_fkey";
ALTER TABLE "QuizAnswer" RENAME CONSTRAINT "KahootAnswer_questionId_fkey" TO "QuizAnswer_questionId_fkey";
ALTER TABLE "QuizAnswer" RENAME CONSTRAINT "KahootAnswer_participantId_fkey" TO "QuizAnswer_participantId_fkey";

-- Rename enum
ALTER TYPE "KahootStatus" RENAME TO "QuizStatus";
