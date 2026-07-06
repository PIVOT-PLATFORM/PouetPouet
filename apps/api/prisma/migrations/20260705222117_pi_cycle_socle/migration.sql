-- CreateEnum
CREATE TYPE "PiCycleStatus" AS ENUM ('PREPARATION', 'ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "PiCycle" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artName" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "PiCycleStatus" NOT NULL DEFAULT 'PREPARATION',
    "eventDay1" TIMESTAMP(3),
    "eventDay2" TIMESTAMP(3),
    "eventLocation" TEXT,
    "logisticsFormId" TEXT,
    "todoDashboardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PiCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PiIteration" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PiIteration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PiCycleTeam" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "order" INTEGER NOT NULL DEFAULT 0,
    "sourceTeamId" TEXT,

    CONSTRAINT "PiCycleTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PiCycle_ownerId_idx" ON "PiCycle"("ownerId");

-- CreateIndex
CREATE INDEX "PiIteration_cycleId_idx" ON "PiIteration"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "PiIteration_cycleId_number_key" ON "PiIteration"("cycleId", "number");

-- CreateIndex
CREATE INDEX "PiCycleTeam_cycleId_idx" ON "PiCycleTeam"("cycleId");

-- AddForeignKey
ALTER TABLE "PiCycle" ADD CONSTRAINT "PiCycle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PiIteration" ADD CONSTRAINT "PiIteration_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PiCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PiCycleTeam" ADD CONSTRAINT "PiCycleTeam_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PiCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
