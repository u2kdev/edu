-- AlterTable
ALTER TABLE "PlatformUser" ADD COLUMN IF NOT EXISTS "notificationPrefsJson" TEXT;

-- AlterTable
ALTER TABLE "LearningCenter" ADD COLUMN IF NOT EXISTS "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "smsDailyLimit" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS "defaultNotificationPrefsJson" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_dedupeKey_idx" ON "Notification"("dedupeKey");
