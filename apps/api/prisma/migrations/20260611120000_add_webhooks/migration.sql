CREATE TABLE "Webhook" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "url"       TEXT NOT NULL,
  "secret"    TEXT NOT NULL,
  "events"    TEXT[] NOT NULL DEFAULT '{}',
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Webhook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX "Webhook_userId_idx" ON "Webhook"("userId");
