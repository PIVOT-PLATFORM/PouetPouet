-- Rattrapage : les membres liés à un compte avant l'introduction du grade par
-- défaut EDITOR restaient sans grade (teamRole NULL) — ils recevaient la notif
-- d'un partage d'équipe sans jamais hériter de l'accès. Aligne l'existant sur
-- la nouvelle règle (lien = grade EDITOR par défaut).
UPDATE "TeamMember" SET "teamRole" = 'EDITOR' WHERE "userId" IS NOT NULL AND "teamRole" IS NULL;
