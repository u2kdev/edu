-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "twoFactorPendingSecret" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "twoFactorBackupCodes" TEXT;
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "twoFactorLastStep" INTEGER;
