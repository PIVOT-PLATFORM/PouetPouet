-- CreateEnum
CREATE TYPE "ScrumTicketStatus" AS ENUM ('PENDING', 'VOTING', 'REVEALED', 'DONE');

-- CreateTable
CREATE TABLE "ScrumRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrumRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrumTicket" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "estimate" TEXT,
    "order" INTEGER NOT NULL,
    "status" "ScrumTicketStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrumTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrumVote" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "participantName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrumVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScrumRoom_code_key" ON "ScrumRoom"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ScrumVote_ticketId_participantName_key" ON "ScrumVote"("ticketId", "participantName");

-- AddForeignKey
ALTER TABLE "ScrumRoom" ADD CONSTRAINT "ScrumRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrumTicket" ADD CONSTRAINT "ScrumTicket_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ScrumRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrumVote" ADD CONSTRAINT "ScrumVote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ScrumTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
