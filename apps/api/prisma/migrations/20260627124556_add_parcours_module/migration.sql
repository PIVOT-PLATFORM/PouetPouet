-- CreateEnum
CREATE TYPE "TestBookStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('TODO', 'PASS', 'FAIL', 'BLOCKED', 'SKIP');

-- CreateEnum
CREATE TYPE "ParcourStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ParcourDocClass" AS ENUM ('C0', 'C1', 'C2', 'C3');

-- CreateTable
CREATE TABLE "TestBook" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "status" "TestBookStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSection" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "precondition" TEXT,
    "steps" TEXT,
    "expected" TEXT,
    "status" "TestCaseStatus" NOT NULL DEFAULT 'TODO',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcourTemplate" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "starCount" INTEGER NOT NULL DEFAULT 0,
    "steps" JSONB NOT NULL,
    "defaultObservers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcourTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcourStar" (
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ParcourInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "refNumber" TEXT,
    "status" "ParcourStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParcourInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcourStepInstance" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "data" JSONB,

    CONSTRAINT "ParcourStepInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcourDocument" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepIndex" INTEGER,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "classification" "ParcourDocClass" NOT NULL DEFAULT 'C1',
    "encryptedKey" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcourDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcourHistory" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "stepIndex" INTEGER,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParcourHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParcourSeq" (
    "category" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ParcourSeq_pkey" PRIMARY KEY ("category")
);

-- CreateIndex
CREATE INDEX "ParcourTemplate_ownerId_idx" ON "ParcourTemplate"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcourStar_userId_templateId_key" ON "ParcourStar"("userId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcourInstance_refNumber_key" ON "ParcourInstance"("refNumber");

-- CreateIndex
CREATE INDEX "ParcourInstance_ownerId_idx" ON "ParcourInstance"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ParcourStepInstance_instanceId_stepIndex_key" ON "ParcourStepInstance"("instanceId", "stepIndex");

-- CreateIndex
CREATE INDEX "ParcourDocument_instanceId_idx" ON "ParcourDocument"("instanceId");

-- CreateIndex
CREATE INDEX "ParcourHistory_instanceId_createdAt_idx" ON "ParcourHistory"("instanceId", "createdAt");

-- AddForeignKey
ALTER TABLE "TestBook" ADD CONSTRAINT "TestBook_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSection" ADD CONSTRAINT "TestSection_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "TestBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TestSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcourTemplate" ADD CONSTRAINT "ParcourTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcourStar" ADD CONSTRAINT "ParcourStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcourStar" ADD CONSTRAINT "ParcourStar_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ParcourTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcourInstance" ADD CONSTRAINT "ParcourInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ParcourTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcourInstance" ADD CONSTRAINT "ParcourInstance_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcourStepInstance" ADD CONSTRAINT "ParcourStepInstance_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ParcourInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcourDocument" ADD CONSTRAINT "ParcourDocument_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ParcourInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcourDocument" ADD CONSTRAINT "ParcourDocument_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcourHistory" ADD CONSTRAINT "ParcourHistory_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ParcourInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParcourHistory" ADD CONSTRAINT "ParcourHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
