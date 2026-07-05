-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "remindersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderFrequencyDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "FormResponse" ADD COLUMN     "recipientId" TEXT;

-- CreateTable
CREATE TABLE "FormRecipient" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "lastRemindedAt" TIMESTAMP(3),
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormRecipient_token_key" ON "FormRecipient"("token");

-- CreateIndex
CREATE INDEX "FormRecipient_formId_respondedAt_idx" ON "FormRecipient"("formId", "respondedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormRecipient_formId_email_key" ON "FormRecipient"("formId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "FormResponse_formId_recipientId_key" ON "FormResponse"("formId", "recipientId");

-- AddForeignKey
ALTER TABLE "FormResponse" ADD CONSTRAINT "FormResponse_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "FormRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormRecipient" ADD CONSTRAINT "FormRecipient_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
