-- MeetOps v0.4 : historique d'événement + templates.

-- Templates
CREATE TABLE "MeetTemplate" (
  "id"          TEXT NOT NULL,
  "ownerId"     TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "type"        "MeetEventType" NOT NULL DEFAULT 'CUSTOM',
  "color"       TEXT NOT NULL DEFAULT '#475569',
  "lines"       JSONB NOT NULL,
  "isShared"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetTemplate_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "MeetTemplate" ADD CONSTRAINT "MeetTemplate_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lien template d'origine sur l'événement
ALTER TABLE "MeetEvent" ADD COLUMN "templateId" TEXT;
ALTER TABLE "MeetEvent" ADD CONSTRAINT "MeetEvent_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "MeetTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Journal d'activité (niveau événement)
CREATE TABLE "MeetHistory" (
  "id"           TEXT NOT NULL,
  "eventId"      TEXT NOT NULL,
  "meetingId"    TEXT,
  "meetingTitle" TEXT,
  "userId"       TEXT,
  "action"       TEXT NOT NULL,
  "field"        TEXT,
  "oldValue"     TEXT,
  "newValue"     TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetHistory_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "MeetHistory" ADD CONSTRAINT "MeetHistory_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "MeetEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "MeetHistory_eventId_createdAt_idx" ON "MeetHistory"("eventId", "createdAt");
