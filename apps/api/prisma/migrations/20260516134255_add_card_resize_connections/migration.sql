-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "height" DOUBLE PRECISION NOT NULL DEFAULT 128,
ADD COLUMN     "width" DOUBLE PRECISION NOT NULL DEFAULT 192;

-- CreateTable
CREATE TABLE "CardConnection" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardConnection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CardConnection" ADD CONSTRAINT "CardConnection_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardConnection" ADD CONSTRAINT "CardConnection_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardConnection" ADD CONSTRAINT "CardConnection_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
