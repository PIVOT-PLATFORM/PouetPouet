CREATE TABLE "OAuthAccount" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "provider"  TEXT NOT NULL,
  "subject"   TEXT NOT NULL,
  "email"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "OAuthAccount_provider_subject_key" ON "OAuthAccount"("provider", "subject");
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");
