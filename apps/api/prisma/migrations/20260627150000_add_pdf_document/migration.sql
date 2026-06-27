-- CreateTable
CREATE TABLE IF NOT EXISTS "PdfDocument" (
    "id"        TEXT        NOT NULL,
    "ownerId"   TEXT        NOT NULL,
    "name"      TEXT        NOT NULL,
    "pageCount" INTEGER     NOT NULL,
    "size"      INTEGER     NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PdfDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PdfDocument_ownerId_createdAt_idx" ON "PdfDocument"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "PdfDocument"
    ADD CONSTRAINT "PdfDocument_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
