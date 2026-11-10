-- CreateEnum
CREATE TYPE "PlatformPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PlatformPaymentType" AS ENUM ('SUBSCRIPTION', 'ADDON', 'SETUP', 'OTHER');

-- CreateTable
CREATE TABLE "PlatformPayment" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "planId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "status" "PlatformPaymentStatus" NOT NULL DEFAULT 'PAID',
    "paymentType" "PlatformPaymentType" NOT NULL DEFAULT 'SUBSCRIPTION',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "periodStartsAt" TIMESTAMP(3),
    "periodEndsAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "invoiceNumber" TEXT,
    "receiptUrl" TEXT,
    "notes" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundReason" TEXT,
    "refundAmount" INTEGER,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformExpense" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "counterparty" TEXT,
    "receiptUrl" TEXT,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "reversalOfId" TEXT,
    "reversalReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformPayment_centerId_idx" ON "PlatformPayment"("centerId");

-- CreateIndex
CREATE INDEX "PlatformPayment_subscriptionId_idx" ON "PlatformPayment"("subscriptionId");

-- CreateIndex
CREATE INDEX "PlatformPayment_planId_idx" ON "PlatformPayment"("planId");

-- CreateIndex
CREATE INDEX "PlatformPayment_paidAt_idx" ON "PlatformPayment"("paidAt");

-- CreateIndex
CREATE INDEX "PlatformPayment_status_idx" ON "PlatformPayment"("status");

-- CreateIndex
CREATE INDEX "PlatformPayment_invoiceNumber_idx" ON "PlatformPayment"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformExpenseCategory_name_key" ON "PlatformExpenseCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformExpenseCategory_code_key" ON "PlatformExpenseCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformExpense_reversalOfId_key" ON "PlatformExpense"("reversalOfId");

-- CreateIndex
CREATE INDEX "PlatformExpense_categoryId_idx" ON "PlatformExpense"("categoryId");

-- CreateIndex
CREATE INDEX "PlatformExpense_date_idx" ON "PlatformExpense"("date");

-- CreateIndex
CREATE INDEX "PlatformExpense_createdBy_idx" ON "PlatformExpense"("createdBy");

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPayment" ADD CONSTRAINT "PlatformPayment_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformExpense" ADD CONSTRAINT "PlatformExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PlatformExpenseCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformExpense" ADD CONSTRAINT "PlatformExpense_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "PlatformExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformExpense" ADD CONSTRAINT "PlatformExpense_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "PlatformUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
