-- AlterTable
ALTER TABLE "ParcourTemplate" ADD COLUMN "webhookToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ParcourTemplate_webhookToken_key" ON "ParcourTemplate"("webhookToken");
