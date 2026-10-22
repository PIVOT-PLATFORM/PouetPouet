-- AlterTable
ALTER TABLE "ParcourStepInstance" ADD COLUMN     "actorIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Rétro-remplissage des intervenants des instances existantes : l'assigné,
-- les membres de groupe/chaîne (data._group ou définition de l'étape) et les
-- approbateurs d'une approval-chain (définition de l'étape dans le template).
UPDATE "ParcourStepInstance" si
SET "actorIds" = ARRAY(
  SELECT DISTINCT a FROM unnest(
    ARRAY[si."assignedTo"]
    || CASE WHEN jsonb_typeof(si."data"->'_group') = 'array'
         THEN ARRAY(SELECT jsonb_array_elements(si."data"->'_group')->>'id') ELSE ARRAY[]::TEXT[] END
    || CASE WHEN jsonb_typeof(t."steps"->si."stepIndex"->'groupMembers') = 'array'
              AND t."steps"->si."stepIndex"->>'assignmentMode' IN ('group', 'chain')
         THEN ARRAY(SELECT jsonb_array_elements(t."steps"->si."stepIndex"->'groupMembers')->>'id') ELSE ARRAY[]::TEXT[] END
    || CASE WHEN jsonb_typeof(t."steps"->si."stepIndex"->'approvers') = 'array'
              AND t."steps"->si."stepIndex"->>'type' = 'approval-chain'
         THEN ARRAY(SELECT jsonb_array_elements_text(t."steps"->si."stepIndex"->'approvers')) ELSE ARRAY[]::TEXT[] END
  ) AS a
  WHERE a IS NOT NULL AND a <> ''
)
FROM "ParcourInstance" i
JOIN "ParcourTemplate" t ON t."id" = i."templateId"
WHERE i."id" = si."instanceId";
