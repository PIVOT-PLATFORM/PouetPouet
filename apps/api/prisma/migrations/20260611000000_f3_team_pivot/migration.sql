-- FORGE F3.1 — Team pivot
-- Fusionne DailyTeam + CapacityTeam en un seul modèle Team (socle).
-- Les IDs sont conservés tels quels : les FK existantes (DailySession.teamId,
-- CapacityEvent.teamId, WheelDraw.teamId) pointent déjà vers les bons UUIDs.

-- 1. Créer la table Team (même structure que DailyTeam / CapacityTeam)
CREATE TABLE "Team" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "ownerId"     TEXT NOT NULL,
    "color"       TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- 2. Créer la table TeamMember (superset de DailyTeamMember + CapacityTeamMember)
CREATE TABLE "TeamMember" (
    "id"     TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name"   TEXT NOT NULL,
    "role"   TEXT,
    "fte"    DOUBLE PRECISION,
    "order"  INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- 3. FK Team → User
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. FK TeamMember → Team
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Copier DailyTeam → Team
INSERT INTO "Team" ("id", "name", "ownerId", "color", "description", "createdAt", "updatedAt")
SELECT "id", "name", "ownerId", "color", "description", "createdAt", "updatedAt"
FROM "DailyTeam";

-- 6. Copier CapacityTeam → Team (les IDs sont distincts car CUID)
INSERT INTO "Team" ("id", "name", "ownerId", "color", "description", "createdAt", "updatedAt")
SELECT "id", "name", "ownerId", "color", "description", "createdAt", "updatedAt"
FROM "CapacityTeam";

-- 7. Copier DailyTeamMember → TeamMember (role=NULL, fte=NULL)
INSERT INTO "TeamMember" ("id", "teamId", "name", "role", "fte", "order")
SELECT "id", "teamId", "name", NULL, NULL, "order"
FROM "DailyTeamMember";

-- 8. Copier CapacityTeamMember → TeamMember
INSERT INTO "TeamMember" ("id", "teamId", "name", "role", "fte", "order")
SELECT "id", "teamId", "name", "role", "fte", "order"
FROM "CapacityTeamMember";

-- 9. DailySession.teamId : changer la FK de DailyTeam → Team
ALTER TABLE "DailySession" DROP CONSTRAINT "DailySession_teamId_fkey";
ALTER TABLE "DailySession" ADD CONSTRAINT "DailySession_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 10. CapacityEvent.teamId : changer la FK de CapacityTeam → Team
ALTER TABLE "CapacityEvent" DROP CONSTRAINT "CapacityEvent_teamId_fkey";
ALTER TABLE "CapacityEvent" ADD CONSTRAINT "CapacityEvent_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 11. WheelDraw.teamId : changer la FK de DailyTeam → Team
ALTER TABLE "WheelDraw" DROP CONSTRAINT "WheelDraw_teamId_fkey";
ALTER TABLE "WheelDraw" ADD CONSTRAINT "WheelDraw_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 12. Supprimer les anciennes tables (ordre : members avant teams)
DROP TABLE "DailyTeamMember";
DROP TABLE "CapacityTeamMember";
DROP TABLE "DailyTeam";
DROP TABLE "CapacityTeam";
