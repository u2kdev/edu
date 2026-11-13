-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN "username" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformUser" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "PlatformUser" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "PlatformUser" ADD COLUMN "deletedReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_username_key" ON "PlatformUser"("username");

-- CreateIndex
CREATE INDEX "PlatformUser_deletedAt_idx" ON "PlatformUser"("deletedAt");
