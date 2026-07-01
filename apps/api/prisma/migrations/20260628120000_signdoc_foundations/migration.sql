-- CreateEnum
CREATE TYPE "SignStatus" AS ENUM ('DRAFT', 'SENT', 'IN_PROGRESS', 'COMPLETED', 'DECLINED', 'EXPIRED', 'VOIDED');

-- CreateEnum
CREATE TYPE "SignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED');

-- CreateEnum
CREATE TYPE "SignRole" AS ENUM ('SIGNER', 'APPROVER', 'CC');

-- CreateEnum
CREATE TYPE "SignFieldType" AS ENUM ('SIGNATURE', 'INITIALS', 'DATE', 'TEXT');

-- CreateTable
CREATE TABLE "SignEnvelope" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT,
    "status" "SignStatus" NOT NULL DEFAULT 'DRAFT',
    "ordered" BOOLEAN NOT NULL DEFAULT false,
    "originalHash" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "globalDeadline" TIMESTAMP(3),
    "sealLevel" TEXT,
    "sealedHash" TEXT,
    "completedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignRecipient" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "routingOrder" INTEGER NOT NULL DEFAULT 1,
    "role" "SignRole" NOT NULL DEFAULT 'SIGNER',
    "status" "SignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(3),
    "accessTokenHash" TEXT,
    "tokenExpires" TIMESTAMP(3),
    "authMethod" TEXT,
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignField" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "w" DOUBLE PRECISION NOT NULL,
    "h" DOUBLE PRECISION NOT NULL,
    "type" "SignFieldType" NOT NULL DEFAULT 'SIGNATURE',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignEvent" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "recipientId" TEXT,
    "type" TEXT NOT NULL,
    "actorLabel" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "payload" JSONB,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignEnvelope_ownerId_createdAt_idx" ON "SignEnvelope"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "SignEnvelope_status_idx" ON "SignEnvelope"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SignRecipient_accessTokenHash_key" ON "SignRecipient"("accessTokenHash");

-- CreateIndex
CREATE INDEX "SignRecipient_envelopeId_routingOrder_idx" ON "SignRecipient"("envelopeId", "routingOrder");

-- CreateIndex
CREATE INDEX "SignRecipient_userId_idx" ON "SignRecipient"("userId");

-- CreateIndex
CREATE INDEX "SignField_envelopeId_idx" ON "SignField"("envelopeId");

-- CreateIndex
CREATE INDEX "SignField_recipientId_idx" ON "SignField"("recipientId");

-- CreateIndex
CREATE INDEX "SignEvent_envelopeId_createdAt_idx" ON "SignEvent"("envelopeId", "createdAt");

-- AddForeignKey
ALTER TABLE "SignEnvelope" ADD CONSTRAINT "SignEnvelope_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignRecipient" ADD CONSTRAINT "SignRecipient_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "SignEnvelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignRecipient" ADD CONSTRAINT "SignRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignField" ADD CONSTRAINT "SignField_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "SignEnvelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignField" ADD CONSTRAINT "SignField_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "SignRecipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignEvent" ADD CONSTRAINT "SignEvent_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "SignEnvelope"("id") ON DELETE CASCADE ON UPDATE CASCADE;
