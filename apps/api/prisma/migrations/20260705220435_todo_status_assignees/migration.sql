-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TodoItemStatus" ADD VALUE 'IN_PROGRESS';
ALTER TYPE "TodoItemStatus" ADD VALUE 'BLOCKED';

-- AlterTable
ALTER TABLE "TodoItem" ADD COLUMN     "assigneeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
