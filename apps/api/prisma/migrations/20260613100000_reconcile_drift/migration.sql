-- Réconciliation de dérive migrations ↔ schema.prisma.
-- Les migrations écrites à la main avaient ajouté des DEFAULT (updatedAt, tableaux),
-- des index et des FK que schema.prisma ne déclare pas (Prisma gère ces valeurs côté
-- application). La base de dev reflète déjà schema.prisma : cette migration aligne
-- l'HISTORIQUE des migrations sur le schéma, pour que `prisma migrate dev`
-- ne détecte plus de dérive. Aucune perte de données.

-- DropForeignKey (re-créées à l'identique plus bas — normalisation)
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";
ALTER TABLE "OAuthAccount" DROP CONSTRAINT "OAuthAccount_userId_fkey";
ALTER TABLE "ScrumRoom" DROP CONSTRAINT "ScrumRoom_teamId_fkey";
ALTER TABLE "Webhook" DROP CONSTRAINT "Webhook_userId_fkey";
ALTER TABLE "WebhookDelivery" DROP CONSTRAINT "WebhookDelivery_webhookId_fkey";

-- DropIndex (non déclarés dans schema.prisma)
DROP INDEX "Board_templateDraftOf_idx";
DROP INDEX "ScrumRoom_teamId_idx";

-- AlterTable : retirer les DEFAULT non déclarés dans le schéma
ALTER TABLE "BoardVoteSession" ALTER COLUMN "voterIds" DROP DEFAULT;
ALTER TABLE "CapacityEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "DailySession" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "MeetEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Meeting" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Webhook" ALTER COLUMN "events" DROP DEFAULT;
ALTER TABLE "WheelDraw" ALTER COLUMN "results" DROP DEFAULT,
ALTER COLUMN "excluded" DROP DEFAULT;
ALTER TABLE "WheelEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey (re-création normalisée)
ALTER TABLE "OAuthAccount" ADD CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScrumRoom" ADD CONSTRAINT "ScrumRoom_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
