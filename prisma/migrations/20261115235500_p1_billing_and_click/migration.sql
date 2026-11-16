-- AlterTable LearningCenter
ALTER TABLE "LearningCenter"
  ADD COLUMN IF NOT EXISTS "allowAdminDiscount" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "partialPaymentExtendsPeriod" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Enrollment
ALTER TABLE "Enrollment"
  ADD COLUMN IF NOT EXISTS "paidUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "frozenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "frozenUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Enrollment_centerId_paidUntil_idx" ON "Enrollment"("centerId", "paidUntil");

-- AlterTable FinanceTransaction
ALTER TABLE "FinanceTransaction"
  ADD COLUMN IF NOT EXISTS "refundPaymentId" TEXT;

CREATE INDEX IF NOT EXISTS "FinanceTransaction_refundPaymentId_idx" ON "FinanceTransaction"("refundPaymentId");

-- CreateTable GroupPricingPlan
CREATE TABLE IF NOT EXISTS "GroupPricingPlan" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "periodMonths" INTEGER NOT NULL,
  "price" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GroupPricingPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GroupPricingPlan_periodMonths_check" CHECK ("periodMonths" IN (1, 2, 3)),
  CONSTRAINT "GroupPricingPlan_price_check" CHECK ("price" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "GroupPricingPlan_groupId_periodMonths_key" ON "GroupPricingPlan"("groupId", "periodMonths");
CREATE INDEX IF NOT EXISTS "GroupPricingPlan_centerId_groupId_idx" ON "GroupPricingPlan"("centerId", "groupId");

-- CreateTable EnrollmentFreeze
CREATE TABLE IF NOT EXISTS "EnrollmentFreeze" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "studentMembershipId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "plannedEndDate" TIMESTAMP(3) NOT NULL,
  "actualEndDate" TIMESTAMP(3),
  "creditedDays" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT NOT NULL,
  "status" "FreezeStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdByUserId" TEXT NOT NULL,
  "unfrozenByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnrollmentFreeze_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EnrollmentFreeze_centerId_enrollmentId_status_idx" ON "EnrollmentFreeze"("centerId", "enrollmentId", "status");
CREATE INDEX IF NOT EXISTS "EnrollmentFreeze_studentMembershipId_idx" ON "EnrollmentFreeze"("studentMembershipId");

-- CreateTable PromoCode
CREATE TABLE IF NOT EXISTS "PromoCode" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "discountType" "PromoDiscountType" NOT NULL,
  "value" INTEGER NOT NULL,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "maxUses" INTEGER,
  "usesCount" INTEGER NOT NULL DEFAULT 0,
  "applicableCourseId" TEXT,
  "applicableGroupId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromoCode_value_check" CHECK ("value" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromoCode_centerId_code_key" ON "PromoCode"("centerId", "code");
CREATE INDEX IF NOT EXISTS "PromoCode_centerId_isActive_idx" ON "PromoCode"("centerId", "isActive");

-- CreateTable InvoiceCounter
CREATE TABLE IF NOT EXISTS "InvoiceCounter" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "lastSeq" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceCounter_centerId_yearMonth_key" ON "InvoiceCounter"("centerId", "yearMonth");

-- CreateTable Charge
CREATE TABLE IF NOT EXISTS "Charge" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "studentMembershipId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "periodMonths" INTEGER NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "originalAmount" INTEGER NOT NULL,
  "discountAmount" INTEGER NOT NULL DEFAULT 0,
  "discountReason" TEXT,
  "amount" INTEGER NOT NULL,
  "paidAmount" INTEGER NOT NULL DEFAULT 0,
  "status" "ChargeStatus" NOT NULL DEFAULT 'PENDING',
  "promoCodeId" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Charge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Charge_periodMonths_check" CHECK ("periodMonths" IN (1, 2, 3))
);

CREATE UNIQUE INDEX IF NOT EXISTS "Charge_centerId_invoiceNumber_key" ON "Charge"("centerId", "invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Charge_active_enrollment_period_key" ON "Charge"("enrollmentId", "periodStart", "periodEnd") WHERE "status" <> 'CANCELLED';
CREATE INDEX IF NOT EXISTS "Charge_centerId_status_dueDate_idx" ON "Charge"("centerId", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "Charge_enrollmentId_status_idx" ON "Charge"("enrollmentId", "status");
CREATE INDEX IF NOT EXISTS "Charge_studentMembershipId_idx" ON "Charge"("studentMembershipId");

-- CreateTable CenterMerchantConfig
CREATE TABLE IF NOT EXISTS "CenterMerchantConfig" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'CLICK',
  "serviceId" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "merchantUserId" TEXT,
  "encryptedSecretKey" TEXT NOT NULL,
  "targetAccountId" TEXT,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CenterMerchantConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CenterMerchantConfig_centerId_provider_key" ON "CenterMerchantConfig"("centerId", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "CenterMerchantConfig_provider_serviceId_key" ON "CenterMerchantConfig"("provider", "serviceId");

-- CreateTable PaymentIntent
CREATE TABLE IF NOT EXISTS "PaymentIntent" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'CLICK',
  "merchantTransId" TEXT NOT NULL,
  "studentMembershipId" TEXT NOT NULL,
  "enrollmentId" TEXT,
  "groupId" TEXT,
  "chargeId" TEXT,
  "periodMonths" INTEGER NOT NULL DEFAULT 1,
  "promoCodeId" TEXT,
  "originalAmount" INTEGER NOT NULL,
  "discountAmount" INTEGER NOT NULL DEFAULT 0,
  "amount" INTEGER NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'UZS',
  "status" "PaymentIntentStatus" NOT NULL DEFAULT 'CREATED',
  "clickTransId" TEXT,
  "clickPaydocId" TEXT,
  "preparedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "errorCode" INTEGER,
  "errorNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_merchantTransId_key" ON "PaymentIntent"("merchantTransId");
CREATE INDEX IF NOT EXISTS "PaymentIntent_centerId_status_createdAt_idx" ON "PaymentIntent"("centerId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentIntent_studentMembershipId_idx" ON "PaymentIntent"("studentMembershipId");
CREATE INDEX IF NOT EXISTS "PaymentIntent_expiresAt_idx" ON "PaymentIntent"("expiresAt");

-- AlterTable CenterPayment
ALTER TABLE "CenterPayment"
  ADD COLUMN IF NOT EXISTS "discountReason" TEXT,
  ADD COLUMN IF NOT EXISTS "promoCodeId" TEXT,
  ADD COLUMN IF NOT EXISTS "periodMonths" INTEGER,
  ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refundedAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "receiptVerifyHash" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentIntentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CenterPayment_receiptVerifyHash_key" ON "CenterPayment"("receiptVerifyHash");
CREATE UNIQUE INDEX IF NOT EXISTS "CenterPayment_paymentIntentId_key" ON "CenterPayment"("paymentIntentId");
CREATE INDEX IF NOT EXISTS "CenterPayment_centerId_receiptNumber_idx" ON "CenterPayment"("centerId", "receiptNumber");

-- CreateTable ChargePaymentAllocation
CREATE TABLE IF NOT EXISTS "ChargePaymentAllocation" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "chargeId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChargePaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChargePaymentAllocation_chargeId_paymentId_key" ON "ChargePaymentAllocation"("chargeId", "paymentId");
CREATE INDEX IF NOT EXISTS "ChargePaymentAllocation_centerId_chargeId_idx" ON "ChargePaymentAllocation"("centerId", "chargeId");
CREATE INDEX IF NOT EXISTS "ChargePaymentAllocation_paymentId_idx" ON "ChargePaymentAllocation"("paymentId");

-- CreateTable PromoCodeRedemption
CREATE TABLE IF NOT EXISTS "PromoCodeRedemption" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "promoCodeId" TEXT NOT NULL,
  "studentMembershipId" TEXT NOT NULL,
  "chargeId" TEXT,
  "paymentId" TEXT,
  "discountAmount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCodeRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PromoCodeRedemption_promoCodeId_paymentId_key" ON "PromoCodeRedemption"("promoCodeId", "paymentId");
CREATE INDEX IF NOT EXISTS "PromoCodeRedemption_centerId_promoCodeId_idx" ON "PromoCodeRedemption"("centerId", "promoCodeId");
CREATE INDEX IF NOT EXISTS "PromoCodeRedemption_chargeId_idx" ON "PromoCodeRedemption"("chargeId");

-- CreateTable PaymentWebhookEvent
CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "centerId" TEXT,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'CLICK',
  "paymentIntentId" TEXT,
  "serviceId" TEXT,
  "clickTransId" TEXT,
  "merchantTransId" TEXT,
  "action" INTEGER,
  "amount" INTEGER,
  "signatureValid" BOOLEAN NOT NULL DEFAULT false,
  "status" "WebhookProcessStatus" NOT NULL,
  "errorCode" INTEGER,
  "errorNote" TEXT,
  "ipAddress" TEXT,
  "payloadRedactedJson" TEXT,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_centerId_createdAt_idx" ON "PaymentWebhookEvent"("centerId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_clickTransId_action_idx" ON "PaymentWebhookEvent"("clickTransId", "action");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_paymentIntentId_idx" ON "PaymentWebhookEvent"("paymentIntentId");

-- AddForeignKeys cleanly using DO blocks for idempotency
DO $$ BEGIN
  ALTER TABLE "CenterPayment" ADD CONSTRAINT "CenterPayment_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CenterPayment" ADD CONSTRAINT "CenterPayment_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_refundPaymentId_fkey" FOREIGN KEY ("refundPaymentId") REFERENCES "CenterPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GroupPricingPlan" ADD CONSTRAINT "GroupPricingPlan_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GroupPricingPlan" ADD CONSTRAINT "GroupPricingPlan_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "EnrollmentFreeze" ADD CONSTRAINT "EnrollmentFreeze_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "EnrollmentFreeze" ADD CONSTRAINT "EnrollmentFreeze_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "EnrollmentFreeze" ADD CONSTRAINT "EnrollmentFreeze_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "EnrollmentFreeze" ADD CONSTRAINT "EnrollmentFreeze_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_applicableCourseId_fkey" FOREIGN KEY ("applicableCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_applicableGroupId_fkey" FOREIGN KEY ("applicableGroupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CenterPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "InvoiceCounter" ADD CONSTRAINT "InvoiceCounter_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Charge" ADD CONSTRAINT "Charge_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Charge" ADD CONSTRAINT "Charge_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Charge" ADD CONSTRAINT "Charge_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Charge" ADD CONSTRAINT "Charge_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Charge" ADD CONSTRAINT "Charge_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChargePaymentAllocation" ADD CONSTRAINT "ChargePaymentAllocation_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChargePaymentAllocation" ADD CONSTRAINT "ChargePaymentAllocation_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChargePaymentAllocation" ADD CONSTRAINT "ChargePaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CenterPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CenterMerchantConfig" ADD CONSTRAINT "CenterMerchantConfig_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CenterMerchantConfig" ADD CONSTRAINT "CenterMerchantConfig_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentIntent" ADD CONSTRAINT "PaymentIntent_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "PaymentIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
