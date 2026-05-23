-- ══════════════════════════════════════════════════════════════════════════════
-- Catch-up migration: board sharing, daily standup, wheel, + board voting
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "BoardRole" AS ENUM ('VIEWER', 'EDITOR');
CREATE TYPE "DailyStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE');
CREATE TYPE "DailyParticipantStatus" AS ENUM ('WAITING', 'SPEAKING', 'DONE', 'SKIPPED');
CREATE TYPE "DrawMode" AS ENUM ('WEIGHTED', 'RANDOM');
CREATE TYPE "VoteStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- ── User – new columns ────────────────────────────────────────────────────────

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "avatar" TEXT,
  ADD COLUMN IF NOT EXISTS "bio"    TEXT,
  ADD COLUMN IF NOT EXISTS "theme"  TEXT NOT NULL DEFAULT 'light';

-- ── Board – new columns ───────────────────────────────────────────────────────

ALTER TABLE "Board"
  ADD COLUMN IF NOT EXISTS "shareToken"    TEXT,
  ADD COLUMN IF NOT EXISTS "shareLinkRole" "BoardRole" NOT NULL DEFAULT 'VIEWER';

CREATE UNIQUE INDEX IF NOT EXISTS "Board_shareToken_key" ON "Board"("shareToken");

-- ── BoardShare ────────────────────────────────────────────────────────────────

CREATE TABLE "BoardShare" (
  "id"        TEXT        NOT NULL,
  "boardId"   TEXT        NOT NULL,
  "userId"    TEXT        NOT NULL,
  "role"      "BoardRole" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoardShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoardShare_boardId_userId_key" ON "BoardShare"("boardId", "userId");

ALTER TABLE "BoardShare"
  ADD CONSTRAINT "BoardShare_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BoardShare_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id")  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ScrumVote – scale column + unique index update ────────────────────────────

ALTER TABLE "ScrumVote" ADD COLUMN IF NOT EXISTS "scale" TEXT NOT NULL DEFAULT 'FIBONACCI';

-- drop old unique if it exists, recreate with scale
DROP INDEX IF EXISTS "ScrumVote_ticketId_participantName_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ScrumVote_ticketId_participantName_scale_key"
  ON "ScrumVote"("ticketId", "participantName", "scale");

-- ── ScrumTicket – estimateTime ────────────────────────────────────────────────

ALTER TABLE "ScrumTicket" ADD COLUMN IF NOT EXISTS "estimateTime" TEXT;

-- ── Daily Standup ─────────────────────────────────────────────────────────────

CREATE TABLE "DailyTeam" (
  "id"          TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "ownerId"     TEXT         NOT NULL,
  "color"       TEXT         NOT NULL DEFAULT '#6366f1',
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyTeam_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DailyTeam"
  ADD CONSTRAINT "DailyTeam_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DailyTeamMember" (
  "id"     TEXT    NOT NULL,
  "teamId" TEXT    NOT NULL,
  "name"   TEXT    NOT NULL,
  "order"  INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DailyTeamMember_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DailyTeamMember"
  ADD CONSTRAINT "DailyTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "DailyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DailySession" (
  "id"            TEXT          NOT NULL,
  "name"          TEXT          NOT NULL,
  "ownerId"       TEXT          NOT NULL,
  "teamId"        TEXT,
  "timePerPerson" INTEGER       NOT NULL DEFAULT 120,
  "status"        "DailyStatus" NOT NULL DEFAULT 'PENDING',
  "currentIndex"  INTEGER       NOT NULL DEFAULT -1,
  "startedAt"     TIMESTAMP(3),
  "endedAt"       TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailySession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DailySession"
  ADD CONSTRAINT "DailySession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "DailySession_teamId_fkey"  FOREIGN KEY ("teamId")  REFERENCES "DailyTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DailyParticipant" (
  "id"           TEXT                   NOT NULL,
  "sessionId"    TEXT                   NOT NULL,
  "name"         TEXT                   NOT NULL,
  "order"        INTEGER                NOT NULL,
  "speakingAt"   TIMESTAMP(3),
  "doneSpeaking" TIMESTAMP(3),
  "status"       "DailyParticipantStatus" NOT NULL DEFAULT 'WAITING',
  CONSTRAINT "DailyParticipant_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DailyParticipant"
  ADD CONSTRAINT "DailyParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DailySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Wheel / Random picker ─────────────────────────────────────────────────────

CREATE TABLE "WheelEvent" (
  "id"        TEXT         NOT NULL,
  "name"      TEXT         NOT NULL,
  "ownerId"   TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WheelEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WheelEvent"
  ADD CONSTRAINT "WheelEvent_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WheelDraw" (
  "id"        TEXT         NOT NULL,
  "ownerId"   TEXT         NOT NULL,
  "teamId"    TEXT,
  "teamName"  TEXT,
  "eventId"   TEXT,
  "note"      TEXT,
  "count"     INTEGER      NOT NULL,
  "mode"      "DrawMode"   NOT NULL DEFAULT 'WEIGHTED',
  "results"   TEXT[]       NOT NULL DEFAULT '{}',
  "excluded"  TEXT[]       NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WheelDraw_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WheelDraw"
  ADD CONSTRAINT "WheelDraw_ownerId_fkey"  FOREIGN KEY ("ownerId")  REFERENCES "User"("id")       ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WheelDraw_teamId_fkey"   FOREIGN KEY ("teamId")   REFERENCES "DailyTeam"("id")  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WheelDraw_eventId_fkey"  FOREIGN KEY ("eventId")  REFERENCES "WheelEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Board Voting ──────────────────────────────────────────────────────────────

CREATE TABLE "BoardVoteSession" (
  "id"             TEXT         NOT NULL,
  "boardId"        TEXT         NOT NULL,
  "status"         "VoteStatus" NOT NULL DEFAULT 'ACTIVE',
  "votesPerPerson" INTEGER      NOT NULL DEFAULT 3,
  "timerSeconds"   INTEGER,
  "timerEndsAt"    TIMESTAMP(3),
  "voterIds"       TEXT[]       NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"       TIMESTAMP(3),
  CONSTRAINT "BoardVoteSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BoardVoteSession"
  ADD CONSTRAINT "BoardVoteSession_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BoardVote" (
  "id"        TEXT         NOT NULL,
  "sessionId" TEXT         NOT NULL,
  "cardId"    TEXT         NOT NULL,
  "userId"    TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BoardVote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BoardVote"
  ADD CONSTRAINT "BoardVote_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "BoardVoteSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BoardVote_userId_fkey"    FOREIGN KEY ("userId")    REFERENCES "User"("id")             ON DELETE CASCADE ON UPDATE CASCADE;
