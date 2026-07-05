-- CreateEnum
CREATE TYPE "TodoItemStatus" AS ENUM ('TODO', 'DONE', 'CANCELLED');

-- AlterTable: add status, backfill from done, then drop done
ALTER TABLE "TodoItem" ADD COLUMN "status" "TodoItemStatus" NOT NULL DEFAULT 'TODO';

UPDATE "TodoItem" SET "status" = 'DONE' WHERE "done" = true;

ALTER TABLE "TodoItem" DROP COLUMN "done";
