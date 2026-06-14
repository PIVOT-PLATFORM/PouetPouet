-- CreateTable
CREATE TABLE "MeetDistList" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "eventId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetDistList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetDistMember" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT,

    CONSTRAINT "MeetDistMember_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MeetDistList" ADD CONSTRAINT "MeetDistList_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetDistList" ADD CONSTRAINT "MeetDistList_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MeetEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetDistMember" ADD CONSTRAINT "MeetDistMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "MeetDistList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
