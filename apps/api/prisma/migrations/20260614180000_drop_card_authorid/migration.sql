-- Card.authorId n'a jamais été renseigné ni lu (champ mort). Suppression.
ALTER TABLE "Card" DROP COLUMN IF EXISTS "authorId";
