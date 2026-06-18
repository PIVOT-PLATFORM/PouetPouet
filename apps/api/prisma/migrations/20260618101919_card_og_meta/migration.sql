/*
  Warnings:

  - You are about to drop the `TestBook` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TestCase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TestSection` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TestBook" DROP CONSTRAINT "TestBook_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "TestCase" DROP CONSTRAINT "TestCase_sectionId_fkey";

-- DropForeignKey
ALTER TABLE "TestSection" DROP CONSTRAINT "TestSection_bookId_fkey";

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "meta" JSONB;

-- DropTable
DROP TABLE "TestBook";

-- DropTable
DROP TABLE "TestCase";

-- DropTable
DROP TABLE "TestSection";

-- DropEnum
DROP TYPE "TestBookStatus";

-- DropEnum
DROP TYPE "TestCaseStatus";
