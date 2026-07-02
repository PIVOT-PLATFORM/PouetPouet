-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "confirmationMessage" TEXT,
ADD COLUMN     "notifyOnResponse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "redirectUrl" TEXT;
