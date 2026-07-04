-- CreateTable
CREATE TABLE "InnovationComment" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InnovationComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InnovationAttachment" (
    "id" TEXT NOT NULL,
    "ficheId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InnovationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InnovationComment_ficheId_idx" ON "InnovationComment"("ficheId");

-- CreateIndex
CREATE INDEX "InnovationAttachment_ficheId_idx" ON "InnovationAttachment"("ficheId");

-- AddForeignKey
ALTER TABLE "InnovationComment" ADD CONSTRAINT "InnovationComment_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "InnovationFiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InnovationComment" ADD CONSTRAINT "InnovationComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InnovationAttachment" ADD CONSTRAINT "InnovationAttachment_ficheId_fkey" FOREIGN KEY ("ficheId") REFERENCES "InnovationFiche"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InnovationAttachment" ADD CONSTRAINT "InnovationAttachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
