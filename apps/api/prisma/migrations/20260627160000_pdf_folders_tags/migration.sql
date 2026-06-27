-- AlterTable PdfDocument: add folderId + tags
ALTER TABLE "PdfDocument" ADD COLUMN "folderId" TEXT;
ALTER TABLE "PdfDocument" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable PdfFolder
CREATE TABLE "PdfFolder" (
    "id"        TEXT         NOT NULL,
    "ownerId"   TEXT         NOT NULL,
    "parentId"  TEXT,
    "name"      TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PdfFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PdfFolder_ownerId_idx" ON "PdfFolder"("ownerId");
CREATE INDEX "PdfFolder_ownerId_parentId_idx" ON "PdfFolder"("ownerId", "parentId");
CREATE INDEX "PdfDocument_ownerId_folderId_idx" ON "PdfDocument"("ownerId", "folderId");

-- AddForeignKey PdfFolder → User
ALTER TABLE "PdfFolder" ADD CONSTRAINT "PdfFolder_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey PdfFolder → PdfFolder (tree)
ALTER TABLE "PdfFolder" ADD CONSTRAINT "PdfFolder_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "PdfFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey PdfDocument → PdfFolder
ALTER TABLE "PdfDocument" ADD CONSTRAINT "PdfDocument_folderId_fkey"
    FOREIGN KEY ("folderId") REFERENCES "PdfFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
