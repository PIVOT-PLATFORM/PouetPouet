-- AddColumn teamId to ScrumRoom with FK to Team
ALTER TABLE "ScrumRoom" ADD COLUMN IF NOT EXISTS "teamId" TEXT REFERENCES "Team"(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "ScrumRoom_teamId_idx" ON "ScrumRoom"("teamId");
