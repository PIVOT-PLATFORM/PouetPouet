-- CreateTable
CREATE TABLE "TeamModuleShare" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" "ModuleRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamModuleShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamModuleShare_teamId_idx" ON "TeamModuleShare"("teamId");

-- CreateIndex
CREATE INDEX "TeamModuleShare_module_resourceId_idx" ON "TeamModuleShare"("module", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamModuleShare_module_resourceId_teamId_key" ON "TeamModuleShare"("module", "resourceId", "teamId");

-- AddForeignKey
ALTER TABLE "TeamModuleShare" ADD CONSTRAINT "TeamModuleShare_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
