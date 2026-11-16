-- P2 Step 1b: Unified Notifications, Quiet Hours, Telegram Bot, Hourly Reminders, Broadcasts & Plan Features

ALTER TABLE "LearningCenter"
  ADD COLUMN IF NOT EXISTS "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "paymentReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "paymentReminderDaysJson" TEXT,
  ADD COLUMN IF NOT EXISTS "quietHoursStart" INTEGER NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS "quietHoursEnd" INTEGER NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS "reminderTemplateRu" TEXT,
  ADD COLUMN IF NOT EXISTS "reminderTemplateUz" TEXT;

-- Migrate legacy enableSms / enableEmail flags out of brandingConfig JSON onto LearningCenter columns
DO $$
DECLARE
  rec RECORD;
  cfg jsonb;
  next_sms boolean;
  next_email boolean;
BEGIN
  FOR rec IN
    SELECT "id", "brandingConfig", "smsEnabled", "emailEnabled"
    FROM "LearningCenter"
    WHERE "brandingConfig" IS NOT NULL AND trim("brandingConfig") <> ''
  LOOP
    BEGIN
      cfg := rec."brandingConfig"::jsonb;
      IF jsonb_typeof(cfg) = 'object' THEN
        next_sms := rec."smsEnabled";
        next_email := rec."emailEnabled";

        IF cfg ? 'enableSms' AND jsonb_typeof(cfg -> 'enableSms') = 'boolean' THEN
          next_sms := (cfg ->> 'enableSms')::boolean;
        END IF;

        IF cfg ? 'enableEmail' AND jsonb_typeof(cfg -> 'enableEmail') = 'boolean' THEN
          next_email := (cfg ->> 'enableEmail')::boolean;
        END IF;

        UPDATE "LearningCenter"
        SET
          "smsEnabled" = next_sms,
          "emailEnabled" = next_email,
          "brandingConfig" = CASE
            WHEN (cfg - 'enableSms' - 'enableEmail') = '{}'::jsonb THEN NULL
            ELSE (cfg - 'enableSms' - 'enableEmail')::text
          END
        WHERE "id" = rec."id";
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END LOOP;
END
$$;

CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "centerId" TEXT,
  "channel" "NotificationChannel" NOT NULL,
  "type" "NotificationType" NOT NULL DEFAULT 'GENERAL',
  "eventKey" TEXT,
  "recipient" TEXT,
  "subject" TEXT,
  "payloadJson" TEXT,
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "errorMessage" TEXT,
  "deferredUntil" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotificationDelivery_centerId_createdAt_idx" ON "NotificationDelivery"("centerId", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_userId_createdAt_idx" ON "NotificationDelivery"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_deferredUntil_idx" ON "NotificationDelivery"("status", "deferredUntil");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_eventKey_idx" ON "NotificationDelivery"("eventKey");

DO $$ BEGIN
  ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_centerId_fkey"
    FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TelegramAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "telegramId" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "username" TEXT,
  "firstName" TEXT,
  "languageCode" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isBlocked" BOOLEAN NOT NULL DEFAULT false,
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastInboundAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TelegramAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramAccount_userId_key" ON "TelegramAccount"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramAccount_telegramId_key" ON "TelegramAccount"("telegramId");
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramAccount_chatId_key" ON "TelegramAccount"("chatId");
CREATE INDEX IF NOT EXISTS "TelegramAccount_chatId_idx" ON "TelegramAccount"("chatId");

DO $$ BEGIN
  ALTER TABLE "TelegramAccount" ADD CONSTRAINT "TelegramAccount_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "TelegramLinkToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TelegramLinkToken_tokenHash_key" ON "TelegramLinkToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "TelegramLinkToken_userId_idx" ON "TelegramLinkToken"("userId");
CREATE INDEX IF NOT EXISTS "TelegramLinkToken_expiresAt_idx" ON "TelegramLinkToken"("expiresAt");

DO $$ BEGIN
  ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PaymentReminderLog" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "studentMembershipId" TEXT NOT NULL,
  "chargeId" TEXT,
  "offsetDays" INTEGER NOT NULL,
  "dueDateKey" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "deliveryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentReminderLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentReminderLog_idempotencyKey_key" ON "PaymentReminderLog"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PaymentReminderLog_centerId_dueDateKey_idx" ON "PaymentReminderLog"("centerId", "dueDateKey");
CREATE INDEX IF NOT EXISTS "PaymentReminderLog_studentMembershipId_idx" ON "PaymentReminderLog"("studentMembershipId");

DO $$ BEGIN
  ALTER TABLE "PaymentReminderLog" ADD CONSTRAINT "PaymentReminderLog_centerId_fkey"
    FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentReminderLog" ADD CONSTRAINT "PaymentReminderLog_studentMembershipId_fkey"
    FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentReminderLog" ADD CONSTRAINT "PaymentReminderLog_chargeId_fkey"
    FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CommunicationTemplate" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "locale" "Language" NOT NULL DEFAULT 'ru',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommunicationTemplate_centerId_key_locale_key" ON "CommunicationTemplate"("centerId", "key", "locale");
CREATE INDEX IF NOT EXISTS "CommunicationTemplate_centerId_idx" ON "CommunicationTemplate"("centerId");

DO $$ BEGIN
  ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_centerId_fkey"
    FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Broadcast" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "bodyRu" TEXT NOT NULL,
  "bodyUz" TEXT,
  "channel" "NotificationChannel" NOT NULL,
  "audience" "BroadcastAudience" NOT NULL,
  "targetGroupId" TEXT,
  "targetRole" "MembershipRole",
  "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "estimatedCost" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Broadcast_centerId_createdAt_idx" ON "Broadcast"("centerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Broadcast_status_scheduledAt_idx" ON "Broadcast"("status", "scheduledAt");

DO $$ BEGIN
  ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_centerId_fkey"
    FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Broadcast" ADD CONSTRAINT "Broadcast_targetGroupId_fkey"
    FOREIGN KEY ("targetGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "BroadcastRecipient" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "broadcastId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "locale" "Language" NOT NULL DEFAULT 'ru',
  "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryId" TEXT,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BroadcastRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BroadcastRecipient_broadcastId_userId_channel_key" ON "BroadcastRecipient"("broadcastId", "userId", "channel");
CREATE INDEX IF NOT EXISTS "BroadcastRecipient_centerId_broadcastId_idx" ON "BroadcastRecipient"("centerId", "broadcastId");
CREATE INDEX IF NOT EXISTS "BroadcastRecipient_status_idx" ON "BroadcastRecipient"("status");

DO $$ BEGIN
  ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_centerId_fkey"
    FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_broadcastId_fkey"
    FOREIGN KEY ("broadcastId") REFERENCES "Broadcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BroadcastRecipient" ADD CONSTRAINT "BroadcastRecipient_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill existing plans with full feature flags so existing centers are never broken on migration
UPDATE "SubscriptionPlan"
SET "featuresJson" = '{"onlinePaymentsClick":true,"telegramBot":true,"smsReminders":true,"broadcasts":true,"advancedReports":true,"mobileApp":true,"pdfReceipts":true,"promoCodes":true,"financeAccounting":true}'
WHERE "featuresJson" IS NULL OR trim("featuresJson") = '';

-- Seed default Старт / Рост / Про plans idempotently (no-op if IDs already exist)
INSERT INTO "SubscriptionPlan" ("id", "name", "maxStudents", "maxTeachers", "maxCourses", "maxBranches", "maxStorage", "priceMonthly", "featuresJson", "isActive", "updatedAt")
VALUES
  (
    'plan-start',
    'Старт',
    50,
    5,
    10,
    1,
    2048,
    290000,
    '{"onlinePaymentsClick":false,"telegramBot":true,"smsReminders":false,"broadcasts":false,"advancedReports":false,"mobileApp":true,"pdfReceipts":true,"promoCodes":false,"financeAccounting":false}',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'plan-growth',
    'Рост',
    200,
    20,
    40,
    3,
    10240,
    590000,
    '{"onlinePaymentsClick":true,"telegramBot":true,"smsReminders":true,"broadcasts":true,"advancedReports":true,"mobileApp":true,"pdfReceipts":true,"promoCodes":true,"financeAccounting":false}',
    true,
    CURRENT_TIMESTAMP
  ),
  (
    'plan-pro',
    'Про',
    1000,
    100,
    200,
    10,
    51200,
    990000,
    '{"onlinePaymentsClick":true,"telegramBot":true,"smsReminders":true,"broadcasts":true,"advancedReports":true,"mobileApp":true,"pdfReceipts":true,"promoCodes":true,"financeAccounting":true}',
    true,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO NOTHING;
