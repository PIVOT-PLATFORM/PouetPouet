CREATE TABLE "WebhookDelivery" (
  "id"         TEXT NOT NULL,
  "webhookId"  TEXT NOT NULL,
  "event"      TEXT NOT NULL,
  "statusCode" INTEGER,
  "error"      TEXT,
  "durationMs" INTEGER NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebhookDelivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE
);
CREATE INDEX "WebhookDelivery_webhookId_createdAt_idx" ON "WebhookDelivery"("webhookId", "createdAt");
