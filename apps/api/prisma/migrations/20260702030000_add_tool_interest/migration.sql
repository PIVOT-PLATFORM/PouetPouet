-- CreateTable
CREATE TABLE "ToolInterest" (
    "id" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ToolInterest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToolInterest_tool_idx" ON "ToolInterest"("tool");

-- CreateIndex
CREATE UNIQUE INDEX "ToolInterest_tool_userId_key" ON "ToolInterest"("tool", "userId");

-- AddForeignKey
ALTER TABLE "ToolInterest" ADD CONSTRAINT "ToolInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
