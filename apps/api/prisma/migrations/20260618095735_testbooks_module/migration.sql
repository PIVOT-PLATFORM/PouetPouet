-- CreateEnum
CREATE TYPE "TestBookStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TestCaseStatus" AS ENUM ('TODO', 'PASS', 'FAIL', 'BLOCKED', 'SKIP');

-- CreateTable
CREATE TABLE "TestBook" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT,
    "status" "TestBookStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestSection" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "precondition" TEXT,
    "steps" TEXT,
    "expected" TEXT,
    "status" "TestCaseStatus" NOT NULL DEFAULT 'TODO',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TestBook" ADD CONSTRAINT "TestBook_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestSection" ADD CONSTRAINT "TestSection_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "TestBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TestSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
