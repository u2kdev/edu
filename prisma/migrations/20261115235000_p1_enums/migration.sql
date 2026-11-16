-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'FROZEN';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'CANCELLED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PromoDiscountType" AS ENUM ('PERCENT', 'FIXED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FreezeStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentProvider" AS ENUM ('CLICK');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentIntentStatus" AS ENUM ('CREATED', 'PREPARED', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WebhookProcessStatus" AS ENUM ('PROCESSED', 'FAILED', 'REJECTED', 'DUPLICATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
