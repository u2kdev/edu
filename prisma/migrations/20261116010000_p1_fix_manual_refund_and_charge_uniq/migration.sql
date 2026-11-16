-- P1-fix: Manual Click refund confirmation tracking + unique non-cancelled period Charge per enrollment

DO $$
BEGIN
  CREATE TYPE "ManualRefundStatus" AS ENUM ('NONE', 'PENDING_MANUAL', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "CenterPayment"
  ADD COLUMN IF NOT EXISTS "manualRefundStatus" "ManualRefundStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "manualRefundNote" TEXT,
  ADD COLUMN IF NOT EXISTS "manualRefundCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "manualRefundCompletedById" TEXT;

CREATE INDEX IF NOT EXISTS "CenterPayment_centerId_manualRefundStatus_idx"
  ON "CenterPayment" ("centerId", "manualRefundStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "Charge_active_enrollment_period_uq"
  ON "Charge" ("enrollmentId", "periodStart")
  WHERE "status" <> 'CANCELLED';
