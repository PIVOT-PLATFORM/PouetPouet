ALTER TABLE "Board" ADD COLUMN IF NOT EXISTS "templateDraftOf" TEXT;
CREATE INDEX IF NOT EXISTS "Board_templateDraftOf_idx" ON "Board"("templateDraftOf");
