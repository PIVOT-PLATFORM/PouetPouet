-- MeetOps : passage à une liste de réunions à plat.
-- On rattache Meeting directement à MeetEvent (via le eventId de sa série),
-- on ajoute une étiquette libre `label`, puis on supprime MeetSeries.

-- 1. Nouvelles colonnes (eventId nullable le temps du backfill)
ALTER TABLE "Meeting" ADD COLUMN "eventId" TEXT;
ALTER TABLE "Meeting" ADD COLUMN "label" TEXT;

-- 2. Backfill eventId depuis la série + reprise du titre de série en label
UPDATE "Meeting" m
SET "eventId" = s."eventId",
    "label" = s."title"
FROM "MeetSeries" s
WHERE m."seriesId" = s."id";

-- 3. eventId devient obligatoire
ALTER TABLE "Meeting" ALTER COLUMN "eventId" SET NOT NULL;

-- 4. Suppression de l'ancien lien vers la série
ALTER TABLE "Meeting" DROP CONSTRAINT "Meeting_seriesId_fkey";
ALTER TABLE "Meeting" DROP COLUMN "seriesId";

-- 5. Nouveau lien vers l'événement
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "MeetEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. Suppression de la table des séries
DROP TABLE "MeetSeries";
