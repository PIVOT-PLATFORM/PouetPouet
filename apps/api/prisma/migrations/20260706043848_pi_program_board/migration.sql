-- CreateEnum
CREATE TYPE "PiTicketType" AS ENUM ('FEATURE', 'MILESTONE', 'RISK', 'OBJECTIVE', 'STORY', 'ENABLER');

-- CreateEnum
CREATE TYPE "PiDependencyStatus" AS ENUM ('OK', 'BLOCKED');

-- CreateTable
CREATE TABLE "PiTicket" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "teamId" TEXT,
    "iterationId" TEXT,
    "type" "PiTicketType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PiTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PiDependency" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "fromTicketId" TEXT NOT NULL,
    "toTicketId" TEXT NOT NULL,
    "status" "PiDependencyStatus" NOT NULL DEFAULT 'OK',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PiDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PiTicket_cycleId_idx" ON "PiTicket"("cycleId");

-- CreateIndex
CREATE INDEX "PiTicket_teamId_idx" ON "PiTicket"("teamId");

-- CreateIndex
CREATE INDEX "PiTicket_iterationId_idx" ON "PiTicket"("iterationId");

-- CreateIndex
CREATE INDEX "PiDependency_cycleId_idx" ON "PiDependency"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "PiDependency_fromTicketId_toTicketId_key" ON "PiDependency"("fromTicketId", "toTicketId");

-- AddForeignKey
ALTER TABLE "PiTicket" ADD CONSTRAINT "PiTicket_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PiCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PiTicket" ADD CONSTRAINT "PiTicket_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "PiCycleTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PiTicket" ADD CONSTRAINT "PiTicket_iterationId_fkey" FOREIGN KEY ("iterationId") REFERENCES "PiIteration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PiDependency" ADD CONSTRAINT "PiDependency_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PiCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PiDependency" ADD CONSTRAINT "PiDependency_fromTicketId_fkey" FOREIGN KEY ("fromTicketId") REFERENCES "PiTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PiDependency" ADD CONSTRAINT "PiDependency_toTicketId_fkey" FOREIGN KEY ("toTicketId") REFERENCES "PiTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
