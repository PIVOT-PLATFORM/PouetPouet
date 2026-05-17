-- CreateEnum
CREATE TYPE "FieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT');

-- CreateTable
CREATE TABLE "BoardField" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FieldType" NOT NULL DEFAULT 'TEXT',
    "options" JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardFieldValue" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "CardFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardFieldValue_cardId_fieldId_key" ON "CardFieldValue"("cardId", "fieldId");

-- AddForeignKey
ALTER TABLE "BoardField" ADD CONSTRAINT "BoardField_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardFieldValue" ADD CONSTRAINT "CardFieldValue_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardFieldValue" ADD CONSTRAINT "CardFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "BoardField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
