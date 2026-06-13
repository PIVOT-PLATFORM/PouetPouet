-- ══════════════════════════════════════════════════════════════════════════════
-- MeetOps: événements, séries, réunions, participants (socle CRUD)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "MeetEventType"   AS ENUM ('VERSION', 'SPRINT', 'COPIL', 'COMOP', 'RELEASE', 'ONBOARDING', 'CUSTOM');
CREATE TYPE "MeetEventStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');
CREATE TYPE "MeetingStatus"   AS ENUM ('DRAFT', 'SENT', 'UPDATED', 'CANCELLED');
CREATE TYPE "MeetingRsvp"     AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'TENTATIVE');

-- ── MeetEvent ─────────────────────────────────────────────────────────────────

CREATE TABLE "MeetEvent" (
  "id"          TEXT              NOT NULL,
  "ownerId"     TEXT              NOT NULL,
  "name"        TEXT              NOT NULL,
  "description" TEXT,
  "type"        "MeetEventType"   NOT NULL DEFAULT 'CUSTOM',
  "status"      "MeetEventStatus" NOT NULL DEFAULT 'DRAFT',
  "startDate"   TIMESTAMP(3),
  "endDate"     TIMESTAMP(3),
  "color"       TEXT              NOT NULL DEFAULT '#475569',
  "tags"        TEXT[]            NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt"   TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MeetEvent"
  ADD CONSTRAINT "MeetEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── MeetSeries ────────────────────────────────────────────────────────────────

CREATE TABLE "MeetSeries" (
  "id"                 TEXT         NOT NULL,
  "eventId"            TEXT         NOT NULL,
  "title"              TEXT         NOT NULL,
  "recurrence"         JSONB,
  "defaultDurationMin" INTEGER      NOT NULL DEFAULT 60,
  "defaultAgenda"      TEXT,
  "order"              INTEGER      NOT NULL DEFAULT 0,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetSeries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MeetSeries"
  ADD CONSTRAINT "MeetSeries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MeetEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Meeting ───────────────────────────────────────────────────────────────────

CREATE TABLE "Meeting" (
  "id"          TEXT            NOT NULL,
  "seriesId"    TEXT            NOT NULL,
  "title"       TEXT            NOT NULL,
  "startAt"     TIMESTAMP(3)    NOT NULL,
  "durationMin" INTEGER         NOT NULL DEFAULT 60,
  "location"    TEXT,
  "agenda"      TEXT,
  "status"      "MeetingStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Meeting"
  ADD CONSTRAINT "Meeting_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "MeetSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── MeetingParticipant ────────────────────────────────────────────────────────

CREATE TABLE "MeetingParticipant" (
  "id"        TEXT          NOT NULL,
  "meetingId" TEXT          NOT NULL,
  "email"     TEXT          NOT NULL,
  "name"      TEXT,
  "role"      TEXT,
  "rsvp"      "MeetingRsvp" NOT NULL DEFAULT 'PENDING',
  CONSTRAINT "MeetingParticipant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MeetingParticipant"
  ADD CONSTRAINT "MeetingParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
