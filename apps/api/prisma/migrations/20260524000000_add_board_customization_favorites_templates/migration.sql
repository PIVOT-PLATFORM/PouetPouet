-- Board customization fields
ALTER TABLE "Board" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
ALTER TABLE "Board" ADD COLUMN IF NOT EXISTS "maxParticipants" INTEGER;
ALTER TABLE "Board" ADD COLUMN IF NOT EXISTS "enabledActivities" JSONB;

-- BoardFavorite
CREATE TABLE IF NOT EXISTS "BoardFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BoardFavorite_userId_boardId_key" ON "BoardFavorite"("userId", "boardId");

ALTER TABLE "BoardFavorite" ADD CONSTRAINT "BoardFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardFavorite" ADD CONSTRAINT "BoardFavorite_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- BoardTemplate
CREATE TABLE IF NOT EXISTS "BoardTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "maxParticipants" INTEGER,
    "enabledActivities" JSONB,
    "ownerId" TEXT NOT NULL,
    "cards" JSONB NOT NULL,
    "frames" JSONB NOT NULL,
    "connections" JSONB NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BoardTemplate" ADD CONSTRAINT "BoardTemplate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
