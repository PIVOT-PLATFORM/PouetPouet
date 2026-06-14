-- Ordre manuel d'affichage des réunions (drag & drop).
ALTER TABLE "Meeting" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill : ordre initial par date de début, au sein de chaque événement.
WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "eventId" ORDER BY "startAt" ASC) - 1 AS rn
  FROM "Meeting"
)
UPDATE "Meeting" m
SET "order" = ranked.rn
FROM ranked
WHERE m."id" = ranked."id";
