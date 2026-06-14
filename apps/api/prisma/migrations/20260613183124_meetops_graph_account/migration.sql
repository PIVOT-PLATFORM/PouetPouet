-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "sendError" TEXT,
ADD COLUMN     "teamsUrl" TEXT;

-- CreateTable
CREATE TABLE "MeetGraphAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "msUserId" TEXT,
    "msEmail" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetGraphAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetGraphAccount_userId_key" ON "MeetGraphAccount"("userId");

-- AddForeignKey
ALTER TABLE "MeetGraphAccount" ADD CONSTRAINT "MeetGraphAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
