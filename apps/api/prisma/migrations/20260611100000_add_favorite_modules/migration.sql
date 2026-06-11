-- AddColumn favoriteModules to User
ALTER TABLE "User" ADD COLUMN "favoriteModules" TEXT[] NOT NULL DEFAULT '{}';
