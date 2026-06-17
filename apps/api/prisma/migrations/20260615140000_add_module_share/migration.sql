-- CreateEnum
CREATE TYPE "ModuleRole" AS ENUM ('VIEWER', 'EDITOR', 'OWNER');

-- CreateTable
CREATE TABLE "ModuleShare" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ModuleRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModuleShare_userId_idx" ON "ModuleShare"("userId");

-- CreateIndex
CREATE INDEX "ModuleShare_module_resourceId_idx" ON "ModuleShare"("module", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleShare_module_resourceId_userId_key" ON "ModuleShare"("module", "resourceId", "userId");

-- AddForeignKey
ALTER TABLE "ModuleShare" ADD CONSTRAINT "ModuleShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
