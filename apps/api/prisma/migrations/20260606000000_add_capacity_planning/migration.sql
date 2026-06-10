-- ══════════════════════════════════════════════════════════════════════════════
-- Capacity planning: teams, events (PI / sprint / release), members, absences
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "CapacityEventType"   AS ENUM ('PI_PLANNING', 'SPRINT', 'RELEASE', 'CUSTOM');
CREATE TYPE "CapacityEventStatus" AS ENUM ('PLANNING', 'ACTIVE', 'DONE');

-- ── CapacityTeam ──────────────────────────────────────────────────────────────

CREATE TABLE "CapacityTeam" (
  "id"          TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "ownerId"     TEXT         NOT NULL,
  "color"       TEXT         NOT NULL DEFAULT '#6366f1',
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapacityTeam_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CapacityTeam"
  ADD CONSTRAINT "CapacityTeam_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CapacityTeamMember ────────────────────────────────────────────────────────

CREATE TABLE "CapacityTeamMember" (
  "id"     TEXT             NOT NULL,
  "teamId" TEXT             NOT NULL,
  "name"   TEXT             NOT NULL,
  "role"   TEXT,
  "fte"    DOUBLE PRECISION NOT NULL DEFAULT 1,
  "order"  INTEGER          NOT NULL DEFAULT 0,
  CONSTRAINT "CapacityTeamMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CapacityTeamMember"
  ADD CONSTRAINT "CapacityTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "CapacityTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CapacityEvent ─────────────────────────────────────────────────────────────

CREATE TABLE "CapacityEvent" (
  "id"                 TEXT                  NOT NULL,
  "name"               TEXT                  NOT NULL,
  "ownerId"            TEXT                  NOT NULL,
  "teamId"             TEXT,
  "parentId"           TEXT,
  "type"               "CapacityEventType"   NOT NULL DEFAULT 'SPRINT',
  "status"             "CapacityEventStatus" NOT NULL DEFAULT 'PLANNING',
  "startDate"          TIMESTAMP(3)          NOT NULL,
  "endDate"            TIMESTAMP(3)          NOT NULL,
  "workingDays"        INTEGER[]             NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5],
  "hoursPerDay"        DOUBLE PRECISION      NOT NULL DEFAULT 8,
  "focusFactor"        DOUBLE PRECISION      NOT NULL DEFAULT 0.8,
  "pointsPerPersonDay" DOUBLE PRECISION,
  "committedPoints"    DOUBLE PRECISION,
  "completedPoints"    DOUBLE PRECISION,
  "notes"              TEXT,
  "createdAt"          TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapacityEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CapacityEvent"
  ADD CONSTRAINT "CapacityEvent_ownerId_fkey"  FOREIGN KEY ("ownerId")  REFERENCES "User"("id")          ON DELETE CASCADE  ON UPDATE CASCADE,
  ADD CONSTRAINT "CapacityEvent_teamId_fkey"   FOREIGN KEY ("teamId")   REFERENCES "CapacityTeam"("id")  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "CapacityEvent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CapacityEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── CapacityEventMember ───────────────────────────────────────────────────────

CREATE TABLE "CapacityEventMember" (
  "id"          TEXT             NOT NULL,
  "eventId"     TEXT             NOT NULL,
  "name"        TEXT             NOT NULL,
  "role"        TEXT,
  "fte"         DOUBLE PRECISION NOT NULL DEFAULT 1,
  "focusFactor" DOUBLE PRECISION,
  "order"       INTEGER          NOT NULL DEFAULT 0,
  CONSTRAINT "CapacityEventMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CapacityEventMember"
  ADD CONSTRAINT "CapacityEventMember_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CapacityEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CapacityAbsence ───────────────────────────────────────────────────────────

CREATE TABLE "CapacityAbsence" (
  "id"            TEXT             NOT NULL,
  "eventMemberId" TEXT             NOT NULL,
  "startDate"     TIMESTAMP(3)     NOT NULL,
  "endDate"       TIMESTAMP(3)     NOT NULL,
  "fraction"      DOUBLE PRECISION NOT NULL DEFAULT 1,
  "reason"        TEXT,
  "createdAt"     TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CapacityAbsence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CapacityAbsence"
  ADD CONSTRAINT "CapacityAbsence_eventMemberId_fkey" FOREIGN KEY ("eventMemberId") REFERENCES "CapacityEventMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
