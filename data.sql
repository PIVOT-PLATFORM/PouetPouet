-- Development seed data for PouetPouet.
-- Run after Prisma migrations, for example:
--   psql "$DATABASE_URL" -f data.sql
--
-- Test accounts:
--   admin@example.test / password123
--   alice@example.test / password123
--   bob@example.test / password123
--   charlie@example.test / password123
--   viewer@example.test / password123
--
-- Dev API key for admin@example.test:
--   pp_dev0000000000000000000000000000000000000000000000000000000000000

BEGIN;

-- All test accounts share the bcrypt hash for "password123".
WITH seed_users(id, email, name, avatar, bio, theme, palette, favorite_modules) AS (
  VALUES
    ('usr_admin_dev', 'admin@example.test', 'Admin Dev', NULL, 'Compte administrateur de developpement.', 'light', 'default', ARRAY['boards', 'scrum', 'daily']::TEXT[]),
    ('usr_alice_dev', 'alice@example.test', 'Alice Martin', NULL, 'Product owner cote metier.', 'light', 'fde-bleu-vert', ARRAY['boards', 'capacity']::TEXT[]),
    ('usr_bob_dev', 'bob@example.test', 'Bob Durand', NULL, 'Tech lead equipe Forge.', 'dark', 'ocean', ARRAY['scrum', 'wheel']::TEXT[]),
    ('usr_charlie_dev', 'charlie@example.test', 'Charlie Nguyen', NULL, 'Facilitateur agile.', 'light', 'amethyste', ARRAY['daily', 'wheel']::TEXT[]),
    ('usr_viewer_dev', 'viewer@example.test', 'Viewer Demo', NULL, 'Compte lecteur pour tester les partages.', 'light', 'default', ARRAY[]::TEXT[])
)
INSERT INTO "User" (
  "id", "email", "name", "password", "avatar", "bio", "theme", "palette",
  "emailVerified", "favoriteModules", "patchNotesSeenAt", "createdAt", "updatedAt"
)
SELECT
  id,
  email,
  name,
  '$2b$12$yuXFpo/Co3tNOaF/RrugRu03DGorlJdnu0WK2mj5OGgj9Z5LwYjI.',
  avatar,
  bio,
  theme,
  palette,
  true,
  favorite_modules,
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '12 days',
  NOW()
FROM seed_users
ON CONFLICT ("email") DO UPDATE SET
  "name" = EXCLUDED."name",
  "password" = EXCLUDED."password",
  "avatar" = EXCLUDED."avatar",
  "bio" = EXCLUDED."bio",
  "theme" = EXCLUDED."theme",
  "palette" = EXCLUDED."palette",
  "emailVerified" = true,
  "favoriteModules" = EXCLUDED."favoriteModules",
  "patchNotesSeenAt" = EXCLUDED."patchNotesSeenAt",
  "updatedAt" = NOW();

INSERT INTO "OAuthAccount" ("id", "userId", "provider", "subject", "email", "createdAt")
VALUES
  ('oauth_admin_keycloak', 'usr_admin_dev', 'keycloak-dev', 'admin-dev-sub', 'admin@example.test', NOW() - INTERVAL '10 days')
ON CONFLICT ("provider", "subject") DO UPDATE SET
  "userId" = EXCLUDED."userId",
  "email" = EXCLUDED."email";

INSERT INTO "ApiKey" ("id", "userId", "name", "keyHash", "prefix", "lastUsedAt", "expiresAt", "createdAt")
VALUES
  ('apikey_admin_dev', 'usr_admin_dev', 'Cle locale dev', '6acdaf38ebd7b8e96d9e10ce468f0dee99e099b17a4e2e39c393e1e85ea97379', 'dev00000', NOW() - INTERVAL '1 hour', NULL, NOW() - INTERVAL '7 days')
ON CONFLICT ("keyHash") DO UPDATE SET
  "userId" = EXCLUDED."userId",
  "name" = EXCLUDED."name",
  "prefix" = EXCLUDED."prefix",
  "lastUsedAt" = EXCLUDED."lastUsedAt",
  "expiresAt" = EXCLUDED."expiresAt";

INSERT INTO "Team" ("id", "name", "ownerId", "color", "description", "createdAt", "updatedAt")
VALUES
  ('team_forge_dev', 'Equipe Forge', 'usr_admin_dev', '#2563eb', 'Equipe produit utilisee par Scrum, Daily, Roue et Capacite.', NOW() - INTERVAL '11 days', NOW()),
  ('team_design_dev', 'Equipe Design', 'usr_alice_dev', '#14b8a6', 'Equipe transverse pour tester les droits multi-utilisateurs.', NOW() - INTERVAL '9 days', NOW())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "ownerId" = EXCLUDED."ownerId",
  "color" = EXCLUDED."color",
  "description" = EXCLUDED."description",
  "updatedAt" = NOW();

INSERT INTO "TeamMember" ("id", "teamId", "name", "role", "fte", "order")
VALUES
  ('tm_forge_alice', 'team_forge_dev', 'Alice', 'Product Owner', 1, 0),
  ('tm_forge_bob', 'team_forge_dev', 'Bob', 'Tech Lead', 1, 1),
  ('tm_forge_charlie', 'team_forge_dev', 'Charlie', 'Facilitateur', 0.8, 2),
  ('tm_forge_dina', 'team_forge_dev', 'Dina', 'Developpeuse', 1, 3),
  ('tm_forge_eli', 'team_forge_dev', 'Eli', 'QA', 0.6, 4),
  ('tm_design_nora', 'team_design_dev', 'Nora', 'UX', 1, 0),
  ('tm_design_sam', 'team_design_dev', 'Sam', 'UI', 0.8, 1)
ON CONFLICT ("id") DO UPDATE SET
  "teamId" = EXCLUDED."teamId",
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "fte" = EXCLUDED."fte",
  "order" = EXCLUDED."order";

INSERT INTO "Board" (
  "id", "name", "description", "coverImage", "maxParticipants", "enabledActivities",
  "ownerId", "shareToken", "shareLinkRole", "templateDraftOf", "createdAt", "updatedAt"
)
VALUES
  ('board_retro_dev', 'Retro Sprint 42', 'Board de demonstration avec cartes, champs, connexions, votes et partage.', NULL, 24, '["poll","wordcloud","brainstorm"]'::JSONB, 'usr_admin_dev', 'share-retro-dev-token', 'EDITOR', NULL, NOW() - INTERVAL '10 days', NOW()),
  ('board_roadmap_dev', 'Roadmap Produit', 'Board partage en lecture seule pour tester les roles.', NULL, 12, '["qa","poll"]'::JSONB, 'usr_alice_dev', 'share-roadmap-dev-token', 'VIEWER', NULL, NOW() - INTERVAL '8 days', NOW() - INTERVAL '1 day')
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "coverImage" = EXCLUDED."coverImage",
  "maxParticipants" = EXCLUDED."maxParticipants",
  "enabledActivities" = EXCLUDED."enabledActivities",
  "ownerId" = EXCLUDED."ownerId",
  "shareToken" = EXCLUDED."shareToken",
  "shareLinkRole" = EXCLUDED."shareLinkRole",
  "templateDraftOf" = EXCLUDED."templateDraftOf",
  "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "BoardShare" ("id", "boardId", "userId", "role", "createdAt")
VALUES
  ('share_retro_alice', 'board_retro_dev', 'usr_alice_dev', 'OWNER', NOW() - INTERVAL '9 days'),
  ('share_retro_bob', 'board_retro_dev', 'usr_bob_dev', 'EDITOR', NOW() - INTERVAL '9 days'),
  ('share_retro_viewer', 'board_retro_dev', 'usr_viewer_dev', 'VIEWER', NOW() - INTERVAL '8 days'),
  ('share_roadmap_admin', 'board_roadmap_dev', 'usr_admin_dev', 'EDITOR', NOW() - INTERVAL '7 days')
ON CONFLICT ("boardId", "userId") DO UPDATE SET
  "role" = EXCLUDED."role";

INSERT INTO "BoardFavorite" ("id", "userId", "boardId", "createdAt")
VALUES
  ('fav_admin_retro', 'usr_admin_dev', 'board_retro_dev', NOW() - INTERVAL '7 days'),
  ('fav_alice_retro', 'usr_alice_dev', 'board_retro_dev', NOW() - INTERVAL '7 days'),
  ('fav_bob_retro', 'usr_bob_dev', 'board_retro_dev', NOW() - INTERVAL '6 days')
ON CONFLICT ("userId", "boardId") DO NOTHING;

INSERT INTO "Frame" ("id", "boardId", "title", "posX", "posY", "width", "height", "color", "active", "layer", "createdAt", "updatedAt")
VALUES
  ('frame_retro_good', 'board_retro_dev', 'Ce qui marche', -40, -30, 520, 360, '#dcfce7', true, 0, NOW() - INTERVAL '10 days', NOW()),
  ('frame_retro_improve', 'board_retro_dev', 'A ameliorer', 540, -30, 520, 360, '#fee2e2', false, 0, NOW() - INTERVAL '10 days', NOW()),
  ('frame_retro_actions', 'board_retro_dev', 'Actions', 250, 420, 520, 300, '#dbeafe', false, 0, NOW() - INTERVAL '10 days', NOW())
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "posX" = EXCLUDED."posX",
  "posY" = EXCLUDED."posY",
  "width" = EXCLUDED."width",
  "height" = EXCLUDED."height",
  "color" = EXCLUDED."color",
  "active" = EXCLUDED."active",
  "layer" = EXCLUDED."layer",
  "updatedAt" = NOW();

INSERT INTO "BoardField" ("id", "boardId", "name", "emoji", "type", "options", "order", "createdAt")
VALUES
  ('field_retro_priority', 'board_retro_dev', 'Priorite', '!', 'SELECT', '["Basse","Moyenne","Haute"]'::JSONB, 0, NOW() - INTERVAL '10 days'),
  ('field_retro_owner', 'board_retro_dev', 'Responsable', '@', 'TEXT', NULL, 1, NOW() - INTERVAL '10 days'),
  ('field_retro_due', 'board_retro_dev', 'Echeance', '#', 'DATE', NULL, 2, NOW() - INTERVAL '10 days')
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "emoji" = EXCLUDED."emoji",
  "type" = EXCLUDED."type",
  "options" = EXCLUDED."options",
  "order" = EXCLUDED."order";

INSERT INTO "Card" (
  "id", "boardId", "type", "content", "posX", "posY", "width", "height",
  "color", "groupId", "groupColor", "locked", "layer", "authorId", "createdAt", "updatedAt"
)
VALUES
  ('card_retro_1', 'board_retro_dev', 'TEXT', 'Les demos courtes ont aide le metier a reagir plus vite.', 40, 60, 220, 130, '#bbf7d0', 'wins', '#22c55e', false, 2, 'usr_alice_dev', NOW() - INTERVAL '9 days', NOW()),
  ('card_retro_2', 'board_retro_dev', 'TEXT', 'Le pipeline CI est beaucoup plus stable depuis la derniere mise a jour.', 280, 80, 220, 130, '#bbf7d0', 'wins', '#22c55e', false, 2, 'usr_bob_dev', NOW() - INTERVAL '9 days', NOW()),
  ('card_retro_3', 'board_retro_dev', 'TEXT', 'Les specs arrivent parfois trop tard dans le sprint.', 620, 70, 230, 130, '#fecaca', 'pain', '#ef4444', false, 2, 'usr_admin_dev', NOW() - INTERVAL '9 days', NOW()),
  ('card_retro_4', 'board_retro_dev', 'TEXT', 'On manque de visibilite sur les tests exploratoires.', 860, 110, 230, 130, '#fecaca', 'pain', '#ef4444', false, 2, 'usr_viewer_dev', NOW() - INTERVAL '9 days', NOW()),
  ('card_retro_5', 'board_retro_dev', 'LABEL', 'Decision: garder le rituel de refinement du mardi.', 340, 485, 360, 80, '#bfdbfe', 'actions', '#3b82f6', true, 3, 'usr_charlie_dev', NOW() - INTERVAL '8 days', NOW()),
  ('card_retro_6', 'board_retro_dev', 'SHAPE', '{"shape":"diamond","text":"Go / No go release"}', 760, 460, 180, 140, '#fde68a', NULL, NULL, false, 2, 'usr_admin_dev', NOW() - INTERVAL '8 days', NOW()),
  ('card_roadmap_1', 'board_roadmap_dev', 'TEXT', 'Q3: portail self-service pour les equipes.', 80, 80, 260, 140, '#dbeafe', 'q3', '#2563eb', false, 1, 'usr_alice_dev', NOW() - INTERVAL '7 days', NOW()),
  ('card_roadmap_2', 'board_roadmap_dev', 'TEXT', 'Q4: exports et automatisations webhooks.', 380, 80, 260, 140, '#ccfbf1', 'q4', '#14b8a6', false, 1, 'usr_alice_dev', NOW() - INTERVAL '7 days', NOW())
ON CONFLICT ("id") DO UPDATE SET
  "type" = EXCLUDED."type",
  "content" = EXCLUDED."content",
  "posX" = EXCLUDED."posX",
  "posY" = EXCLUDED."posY",
  "width" = EXCLUDED."width",
  "height" = EXCLUDED."height",
  "color" = EXCLUDED."color",
  "groupId" = EXCLUDED."groupId",
  "groupColor" = EXCLUDED."groupColor",
  "locked" = EXCLUDED."locked",
  "layer" = EXCLUDED."layer",
  "authorId" = EXCLUDED."authorId",
  "updatedAt" = NOW();

INSERT INTO "CardFieldValue" ("id", "cardId", "fieldId", "value")
VALUES
  ('cfv_retro_3_priority', 'card_retro_3', 'field_retro_priority', 'Haute'),
  ('cfv_retro_3_owner', 'card_retro_3', 'field_retro_owner', 'Alice'),
  ('cfv_retro_3_due', 'card_retro_3', 'field_retro_due', '2026-06-26'),
  ('cfv_retro_4_priority', 'card_retro_4', 'field_retro_priority', 'Moyenne'),
  ('cfv_retro_5_owner', 'card_retro_5', 'field_retro_owner', 'Charlie')
ON CONFLICT ("cardId", "fieldId") DO UPDATE SET
  "value" = EXCLUDED."value";

INSERT INTO "CardConnection" ("id", "boardId", "fromId", "toId", "label", "color", "shape", "arrow", "dashed", "width", "createdAt")
VALUES
  ('conn_retro_1_5', 'board_retro_dev', 'card_retro_1', 'card_retro_5', 'rituel', '#2563eb', 'curved', 'end', false, 2, NOW() - INTERVAL '8 days'),
  ('conn_retro_3_6', 'board_retro_dev', 'card_retro_3', 'card_retro_6', 'impact release', '#ef4444', 'straight', 'end', true, 2.5, NOW() - INTERVAL '8 days')
ON CONFLICT ("id") DO UPDATE SET
  "label" = EXCLUDED."label",
  "color" = EXCLUDED."color",
  "shape" = EXCLUDED."shape",
  "arrow" = EXCLUDED."arrow",
  "dashed" = EXCLUDED."dashed",
  "width" = EXCLUDED."width";

INSERT INTO "BoardTemplate" (
  "id", "name", "description", "coverImage", "maxParticipants", "enabledActivities",
  "isFavorite", "ownerId", "cards", "frames", "connections", "fields", "createdAt", "updatedAt"
)
VALUES
  (
    'tpl_retro_start_stop_continue',
    'Retro Start Stop Continue',
    'Template de retro simple pour les ateliers de sprint.',
    NULL,
    30,
    '["brainstorm","poll"]'::JSONB,
    true,
    'usr_admin_dev',
    '[{"id":"tpl_card_start","type":"LABEL","content":"Start","posX":80,"posY":80,"width":220,"height":90,"color":"#dcfce7"},{"id":"tpl_card_stop","type":"LABEL","content":"Stop","posX":360,"posY":80,"width":220,"height":90,"color":"#fee2e2"},{"id":"tpl_card_continue","type":"LABEL","content":"Continue","posX":640,"posY":80,"width":220,"height":90,"color":"#dbeafe"}]'::JSONB,
    '[{"id":"tpl_frame_1","title":"Start","posX":40,"posY":40,"width":260,"height":420,"color":"#dcfce7"},{"id":"tpl_frame_2","title":"Stop","posX":340,"posY":40,"width":260,"height":420,"color":"#fee2e2"},{"id":"tpl_frame_3","title":"Continue","posX":640,"posY":40,"width":260,"height":420,"color":"#dbeafe"}]'::JSONB,
    '[]'::JSONB,
    '[{"id":"tpl_field_priority","name":"Priorite","emoji":"!","type":"SELECT","options":["Basse","Moyenne","Haute"],"order":0}]'::JSONB,
    NOW() - INTERVAL '6 days',
    NOW()
  )
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "enabledActivities" = EXCLUDED."enabledActivities",
  "isFavorite" = EXCLUDED."isFavorite",
  "cards" = EXCLUDED."cards",
  "frames" = EXCLUDED."frames",
  "connections" = EXCLUDED."connections",
  "fields" = EXCLUDED."fields",
  "updatedAt" = NOW();

INSERT INTO "BoardVoteSession" ("id", "boardId", "status", "votesPerPerson", "timerSeconds", "timerEndsAt", "voterIds", "createdAt", "closedAt")
VALUES
  ('vote_retro_closed', 'board_retro_dev', 'CLOSED', 3, 300, NULL, ARRAY['usr_admin_dev','usr_alice_dev','usr_bob_dev']::TEXT[], NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '8 minutes')
ON CONFLICT ("id") DO UPDATE SET
  "status" = EXCLUDED."status",
  "votesPerPerson" = EXCLUDED."votesPerPerson",
  "timerSeconds" = EXCLUDED."timerSeconds",
  "voterIds" = EXCLUDED."voterIds",
  "closedAt" = EXCLUDED."closedAt";

INSERT INTO "BoardVote" ("id", "sessionId", "cardId", "userId", "createdAt")
VALUES
  ('bv_retro_admin_3', 'vote_retro_closed', 'card_retro_3', 'usr_admin_dev', NOW() - INTERVAL '5 days'),
  ('bv_retro_alice_3', 'vote_retro_closed', 'card_retro_3', 'usr_alice_dev', NOW() - INTERVAL '5 days'),
  ('bv_retro_bob_4', 'vote_retro_closed', 'card_retro_4', 'usr_bob_dev', NOW() - INTERVAL '5 days')
ON CONFLICT ("id") DO UPDATE SET
  "cardId" = EXCLUDED."cardId",
  "userId" = EXCLUDED."userId";

INSERT INTO "Session" ("id", "boardId", "code", "status", "createdAt", "closedAt")
VALUES
  ('session_retro_live', 'board_retro_dev', 'RETRO1', 'ACTIVE', NOW() - INTERVAL '2 hours', NULL),
  ('session_retro_done', 'board_retro_dev', 'RETRO0', 'CLOSED', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days' + INTERVAL '1 hour')
ON CONFLICT ("code") DO UPDATE SET
  "boardId" = EXCLUDED."boardId",
  "status" = EXCLUDED."status",
  "closedAt" = EXCLUDED."closedAt";

INSERT INTO "SessionParticipant" ("id", "sessionId", "userId", "guestName", "joinedAt")
VALUES
  ('sp_live_admin', 'session_retro_live', 'usr_admin_dev', NULL, NOW() - INTERVAL '2 hours'),
  ('sp_live_alice', 'session_retro_live', 'usr_alice_dev', NULL, NOW() - INTERVAL '2 hours'),
  ('sp_live_guest', 'session_retro_live', NULL, 'Invite Demo', NOW() - INTERVAL '90 minutes')
ON CONFLICT ("id") DO UPDATE SET
  "sessionId" = EXCLUDED."sessionId",
  "userId" = EXCLUDED."userId",
  "guestName" = EXCLUDED."guestName";

INSERT INTO "Activity" ("id", "sessionId", "type", "title", "config", "status", "createdAt")
VALUES
  ('act_live_poll', 'session_retro_live', 'POLL', 'Confiance release', '{"choices":["Go","Mitige","No go"],"multi":false}'::JSONB, 'ACTIVE', NOW() - INTERVAL '80 minutes'),
  ('act_done_cloud', 'session_retro_done', 'WORDCLOUD', 'Mot de la retro', '{"maxWords":3}'::JSONB, 'CLOSED', NOW() - INTERVAL '6 days')
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "config" = EXCLUDED."config",
  "status" = EXCLUDED."status";

INSERT INTO "ActivityResponse" ("id", "activityId", "participantId", "value", "createdAt")
VALUES
  ('ar_poll_admin', 'act_live_poll', 'sp_live_admin', '{"choice":"Go"}'::JSONB, NOW() - INTERVAL '70 minutes'),
  ('ar_poll_alice', 'act_live_poll', 'sp_live_alice', '{"choice":"Mitige"}'::JSONB, NOW() - INTERVAL '68 minutes')
ON CONFLICT ("id") DO UPDATE SET
  "value" = EXCLUDED."value";

INSERT INTO "ScrumRoom" ("id", "name", "code", "ownerId", "teamId", "scale", "createdAt", "updatedAt")
VALUES
  ('scrum_room_forge', 'Poker Sprint 43', 'POKER1', 'usr_admin_dev', 'team_forge_dev', 'FIBONACCI', NOW() - INTERVAL '5 days', NOW())
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "ownerId" = EXCLUDED."ownerId",
  "teamId" = EXCLUDED."teamId",
  "scale" = EXCLUDED."scale",
  "updatedAt" = NOW();

INSERT INTO "ScrumTicket" ("id", "roomId", "title", "estimate", "estimateTime", "order", "status", "createdAt")
VALUES
  ('scrum_ticket_login', 'scrum_room_forge', 'Simplifier la connexion SSO', '5', NULL, 0, 'REVEALED', NOW() - INTERVAL '5 days'),
  ('scrum_ticket_webhooks', 'scrum_room_forge', 'Journaliser les livraisons webhook', NULL, NULL, 1, 'VOTING', NOW() - INTERVAL '5 days'),
  ('scrum_ticket_export', 'scrum_room_forge', 'Exporter les resultats de vote', NULL, NULL, 2, 'PENDING', NOW() - INTERVAL '4 days')
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "estimate" = EXCLUDED."estimate",
  "estimateTime" = EXCLUDED."estimateTime",
  "order" = EXCLUDED."order",
  "status" = EXCLUDED."status";

INSERT INTO "ScrumVote" ("id", "ticketId", "participantName", "value", "scale", "createdAt")
VALUES
  ('sv_login_alice', 'scrum_ticket_login', 'Alice', '5', 'FIBONACCI', NOW() - INTERVAL '4 days'),
  ('sv_login_bob', 'scrum_ticket_login', 'Bob', '5', 'FIBONACCI', NOW() - INTERVAL '4 days'),
  ('sv_login_charlie', 'scrum_ticket_login', 'Charlie', '8', 'FIBONACCI', NOW() - INTERVAL '4 days'),
  ('sv_webhooks_alice', 'scrum_ticket_webhooks', 'Alice', '3', 'FIBONACCI', NOW() - INTERVAL '1 day'),
  ('sv_webhooks_bob', 'scrum_ticket_webhooks', 'Bob', '5', 'FIBONACCI', NOW() - INTERVAL '1 day')
ON CONFLICT ("ticketId", "participantName", "scale") DO UPDATE SET
  "value" = EXCLUDED."value";

INSERT INTO "DailySession" (
  "id", "name", "ownerId", "teamId", "timePerPerson", "status", "currentIndex",
  "startedAt", "endedAt", "createdAt", "updatedAt"
)
VALUES
  ('daily_forge_today', 'Daily Forge', 'usr_admin_dev', 'team_forge_dev', 120, 'RUNNING', 1, NOW() - INTERVAL '10 minutes', NULL, NOW() - INTERVAL '1 day', NOW()),
  ('daily_forge_done', 'Daily Forge precedent', 'usr_admin_dev', 'team_forge_dev', 90, 'DONE', 4, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '12 minutes', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "teamId" = EXCLUDED."teamId",
  "timePerPerson" = EXCLUDED."timePerPerson",
  "status" = EXCLUDED."status",
  "currentIndex" = EXCLUDED."currentIndex",
  "startedAt" = EXCLUDED."startedAt",
  "endedAt" = EXCLUDED."endedAt",
  "updatedAt" = EXCLUDED."updatedAt";

INSERT INTO "DailyParticipant" ("id", "sessionId", "name", "order", "speakingAt", "doneSpeaking", "status")
VALUES
  ('dp_today_alice', 'daily_forge_today', 'Alice', 0, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '8 minutes', 'DONE'),
  ('dp_today_bob', 'daily_forge_today', 'Bob', 1, NOW() - INTERVAL '8 minutes', NULL, 'SPEAKING'),
  ('dp_today_charlie', 'daily_forge_today', 'Charlie', 2, NULL, NULL, 'WAITING'),
  ('dp_today_dina', 'daily_forge_today', 'Dina', 3, NULL, NULL, 'WAITING'),
  ('dp_today_eli', 'daily_forge_today', 'Eli', 4, NULL, NULL, 'WAITING')
ON CONFLICT ("id") DO UPDATE SET
  "sessionId" = EXCLUDED."sessionId",
  "name" = EXCLUDED."name",
  "order" = EXCLUDED."order",
  "speakingAt" = EXCLUDED."speakingAt",
  "doneSpeaking" = EXCLUDED."doneSpeaking",
  "status" = EXCLUDED."status";

INSERT INTO "WheelEvent" ("id", "name", "ownerId", "createdAt", "updatedAt")
VALUES
  ('wheel_event_facilitation', 'Animation ceremonies', 'usr_admin_dev', NOW() - INTERVAL '6 days', NOW())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "ownerId" = EXCLUDED."ownerId",
  "updatedAt" = NOW();

INSERT INTO "WheelDraw" ("id", "ownerId", "teamId", "teamName", "eventId", "note", "count", "mode", "results", "excluded", "createdAt")
VALUES
  ('wheel_draw_1', 'usr_admin_dev', 'team_forge_dev', 'Equipe Forge', 'wheel_event_facilitation', 'Animateur du daily', 1, 'WEIGHTED', ARRAY['Charlie']::TEXT[], ARRAY[]::TEXT[], NOW() - INTERVAL '3 days'),
  ('wheel_draw_2', 'usr_admin_dev', 'team_forge_dev', 'Equipe Forge', 'wheel_event_facilitation', 'Binome demo client', 2, 'RANDOM', ARRAY['Alice','Dina']::TEXT[], ARRAY['Bob']::TEXT[], NOW() - INTERVAL '1 day')
ON CONFLICT ("id") DO UPDATE SET
  "teamId" = EXCLUDED."teamId",
  "teamName" = EXCLUDED."teamName",
  "eventId" = EXCLUDED."eventId",
  "note" = EXCLUDED."note",
  "count" = EXCLUDED."count",
  "mode" = EXCLUDED."mode",
  "results" = EXCLUDED."results",
  "excluded" = EXCLUDED."excluded";

INSERT INTO "CapacityEvent" (
  "id", "name", "ownerId", "teamId", "parentId", "type", "status", "startDate", "endDate",
  "workingDays", "hoursPerDay", "focusFactor", "pointsPerPersonDay", "committedPoints",
  "completedPoints", "notes", "createdAt", "updatedAt"
)
VALUES
  ('capacity_pi_q3', 'PI Planning Q3', 'usr_admin_dev', 'team_forge_dev', NULL, 'PI_PLANNING', 'ACTIVE', DATE '2026-06-15', DATE '2026-09-18', ARRAY[1,2,3,4,5]::INTEGER[], 8, 0.75, 0.65, 220, NULL, 'Objectif: stabiliser le socle collaboratif.', NOW() - INTERVAL '4 days', NOW()),
  ('capacity_sprint_43', 'Sprint 43', 'usr_admin_dev', 'team_forge_dev', 'capacity_pi_q3', 'SPRINT', 'PLANNING', DATE '2026-06-15', DATE '2026-06-28', ARRAY[1,2,3,4,5]::INTEGER[], 8, 0.8, 0.7, 42, NULL, 'Sprint de durcissement avant demo.', NOW() - INTERVAL '3 days', NOW())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "teamId" = EXCLUDED."teamId",
  "parentId" = EXCLUDED."parentId",
  "type" = EXCLUDED."type",
  "status" = EXCLUDED."status",
  "startDate" = EXCLUDED."startDate",
  "endDate" = EXCLUDED."endDate",
  "workingDays" = EXCLUDED."workingDays",
  "hoursPerDay" = EXCLUDED."hoursPerDay",
  "focusFactor" = EXCLUDED."focusFactor",
  "pointsPerPersonDay" = EXCLUDED."pointsPerPersonDay",
  "committedPoints" = EXCLUDED."committedPoints",
  "completedPoints" = EXCLUDED."completedPoints",
  "notes" = EXCLUDED."notes",
  "updatedAt" = NOW();

INSERT INTO "CapacityEventMember" ("id", "eventId", "name", "role", "fte", "focusFactor", "order")
VALUES
  ('cem_s43_alice', 'capacity_sprint_43', 'Alice', 'Product Owner', 1, NULL, 0),
  ('cem_s43_bob', 'capacity_sprint_43', 'Bob', 'Tech Lead', 1, 0.75, 1),
  ('cem_s43_charlie', 'capacity_sprint_43', 'Charlie', 'Facilitateur', 0.8, NULL, 2),
  ('cem_s43_dina', 'capacity_sprint_43', 'Dina', 'Developpeuse', 1, NULL, 3),
  ('cem_s43_eli', 'capacity_sprint_43', 'Eli', 'QA', 0.6, NULL, 4)
ON CONFLICT ("id") DO UPDATE SET
  "eventId" = EXCLUDED."eventId",
  "name" = EXCLUDED."name",
  "role" = EXCLUDED."role",
  "fte" = EXCLUDED."fte",
  "focusFactor" = EXCLUDED."focusFactor",
  "order" = EXCLUDED."order";

INSERT INTO "CapacityAbsence" ("id", "eventMemberId", "startDate", "endDate", "fraction", "reason", "createdAt")
VALUES
  ('absence_s43_eli', 'cem_s43_eli', DATE '2026-06-19', DATE '2026-06-20', 1, 'Conge', NOW() - INTERVAL '2 days'),
  ('absence_s43_charlie', 'cem_s43_charlie', DATE '2026-06-24', DATE '2026-06-24', 0.5, 'Atelier externe', NOW() - INTERVAL '2 days')
ON CONFLICT ("id") DO UPDATE SET
  "eventMemberId" = EXCLUDED."eventMemberId",
  "startDate" = EXCLUDED."startDate",
  "endDate" = EXCLUDED."endDate",
  "fraction" = EXCLUDED."fraction",
  "reason" = EXCLUDED."reason";

INSERT INTO "Webhook" ("id", "userId", "name", "url", "secret", "events", "active", "createdAt", "updatedAt")
VALUES
  ('webhook_admin_local', 'usr_admin_dev', 'Webhook local', 'https://example.test/webhooks/pouetpouet', 'dev-secret-change-me', ARRAY['board.updated','wheel.draw.completed','capacity.updated']::TEXT[], true, NOW() - INTERVAL '4 days', NOW())
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "url" = EXCLUDED."url",
  "secret" = EXCLUDED."secret",
  "events" = EXCLUDED."events",
  "active" = EXCLUDED."active",
  "updatedAt" = NOW();

INSERT INTO "WebhookDelivery" ("id", "webhookId", "event", "statusCode", "error", "durationMs", "createdAt")
VALUES
  ('whd_admin_ok', 'webhook_admin_local', 'wheel.draw.completed', 200, NULL, 143, NOW() - INTERVAL '1 day'),
  ('whd_admin_fail', 'webhook_admin_local', 'board.updated', 500, 'Endpoint returned 500', 911, NOW() - INTERVAL '8 hours')
ON CONFLICT ("id") DO UPDATE SET
  "event" = EXCLUDED."event",
  "statusCode" = EXCLUDED."statusCode",
  "error" = EXCLUDED."error",
  "durationMs" = EXCLUDED."durationMs";

INSERT INTO "Notification" ("id", "userId", "type", "title", "body", "link", "readAt", "createdAt")
VALUES
  ('notif_alice_share', 'usr_alice_dev', 'board.shared', 'Board partage', 'Admin Dev vous a ajoute comme proprietaire du board Retro Sprint 42.', '/boards/board_retro_dev', NULL, NOW() - INTERVAL '9 days'),
  ('notif_bob_share', 'usr_bob_dev', 'board.shared', 'Board partage', 'Admin Dev vous a ajoute comme editeur du board Retro Sprint 42.', '/boards/board_retro_dev', NOW() - INTERVAL '5 days', NOW() - INTERVAL '9 days'),
  ('notif_admin_webhook', 'usr_admin_dev', 'webhook.delivery_failed', 'Webhook en erreur', 'La derniere livraison du webhook local a retourne une erreur.', '/profile', NULL, NOW() - INTERVAL '8 hours')
ON CONFLICT ("id") DO UPDATE SET
  "title" = EXCLUDED."title",
  "body" = EXCLUDED."body",
  "link" = EXCLUDED."link",
  "readAt" = EXCLUDED."readAt";

INSERT INTO "AuditLog" ("id", "userId", "action", "resource", "ip", "userAgent", "createdAt")
VALUES
  ('audit_admin_login', 'usr_admin_dev', 'auth.login', NULL, '127.0.0.1', 'dev-seed', NOW() - INTERVAL '1 hour'),
  ('audit_admin_apikey', 'usr_admin_dev', 'apikey.created', 'Cle locale dev', '127.0.0.1', 'dev-seed', NOW() - INTERVAL '7 days'),
  ('audit_alice_login', 'usr_alice_dev', 'auth.login', NULL, '127.0.0.1', 'dev-seed', NOW() - INTERVAL '3 hours')
ON CONFLICT ("id") DO UPDATE SET
  "action" = EXCLUDED."action",
  "resource" = EXCLUDED."resource",
  "ip" = EXCLUDED."ip",
  "userAgent" = EXCLUDED."userAgent",
  "createdAt" = EXCLUDED."createdAt";

COMMIT;
