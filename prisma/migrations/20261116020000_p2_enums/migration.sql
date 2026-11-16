-- P2 Step 1a: Enum additions for Telegram notifications, delivery status, and broadcasts

ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'TELEGRAM';

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BROADCAST';

DO $$
BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DEFERRED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "BroadcastAudience" AS ENUM ('ALL', 'DEBTORS', 'OVERDUE', 'GROUP', 'ROLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
