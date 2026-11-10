-- Add ACCOUNTANT to MembershipRole enum
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'ACCOUNTANT';

-- Create Enums for Finance Accounting
CREATE TYPE "AccountType" AS ENUM ('CASH', 'CARD', 'BANK');
CREATE TYPE "FinanceCategoryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinanceTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');
CREATE TYPE "FinancePeriodStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "SalaryRateType" AS ENUM ('HOURLY', 'PERCENTAGE', 'FIXED');

-- CreateTable Account
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'CASH',
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable FinanceCategory
CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FinanceCategoryType" NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable FinancePeriod
CREATE TABLE "FinancePeriod" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FinancePeriodStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedByMembershipId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable FinanceTransaction
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "type" "FinanceTransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "accountId" TEXT NOT NULL,
    "targetAccountId" TEXT,
    "categoryId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "counterparty" TEXT,
    "studentMembershipId" TEXT,
    "groupId" TEXT,
    "courseId" TEXT,
    "branchId" TEXT,
    "centerPaymentId" TEXT,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "reversalOfId" TEXT,
    "reversalReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable TeacherSalaryRate
CREATE TABLE "TeacherSalaryRate" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "teacherMembershipId" TEXT NOT NULL,
    "groupId" TEXT,
    "rateType" "SalaryRateType" NOT NULL DEFAULT 'HOURLY',
    "amount" INTEGER NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'UZS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherSalaryRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_centerId_idx" ON "Account"("centerId");
CREATE UNIQUE INDEX "Account_centerId_name_key" ON "Account"("centerId", "name");

-- CreateIndex
CREATE INDEX "FinanceCategory_centerId_idx" ON "FinanceCategory"("centerId");
CREATE UNIQUE INDEX "FinanceCategory_centerId_name_type_key" ON "FinanceCategory"("centerId", "name", "type");

-- CreateIndex
CREATE INDEX "FinancePeriod_centerId_idx" ON "FinancePeriod"("centerId");
CREATE UNIQUE INDEX "FinancePeriod_centerId_year_month_key" ON "FinancePeriod"("centerId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTransaction_reversalOfId_key" ON "FinanceTransaction"("reversalOfId");
CREATE UNIQUE INDEX "FinanceTransaction_centerPaymentId_isReversal_key" ON "FinanceTransaction"("centerPaymentId", "isReversal");
CREATE INDEX "FinanceTransaction_centerId_idx" ON "FinanceTransaction"("centerId");
CREATE INDEX "FinanceTransaction_accountId_idx" ON "FinanceTransaction"("accountId");
CREATE INDEX "FinanceTransaction_targetAccountId_idx" ON "FinanceTransaction"("targetAccountId");
CREATE INDEX "FinanceTransaction_categoryId_idx" ON "FinanceTransaction"("categoryId");
CREATE INDEX "FinanceTransaction_date_idx" ON "FinanceTransaction"("date");
CREATE INDEX "FinanceTransaction_studentMembershipId_idx" ON "FinanceTransaction"("studentMembershipId");
CREATE INDEX "FinanceTransaction_groupId_idx" ON "FinanceTransaction"("groupId");
CREATE INDEX "FinanceTransaction_courseId_idx" ON "FinanceTransaction"("courseId");
CREATE INDEX "FinanceTransaction_branchId_idx" ON "FinanceTransaction"("branchId");
CREATE INDEX "FinanceTransaction_centerPaymentId_idx" ON "FinanceTransaction"("centerPaymentId");

-- CreateIndex
CREATE INDEX "TeacherSalaryRate_centerId_idx" ON "TeacherSalaryRate"("centerId");
CREATE INDEX "TeacherSalaryRate_teacherMembershipId_idx" ON "TeacherSalaryRate"("teacherMembershipId");
CREATE INDEX "TeacherSalaryRate_groupId_idx" ON "TeacherSalaryRate"("groupId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancePeriod" ADD CONSTRAINT "FinancePeriod_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancePeriod" ADD CONSTRAINT "FinancePeriod_closedByMembershipId_fkey" FOREIGN KEY ("closedByMembershipId") REFERENCES "CenterMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_centerPaymentId_fkey" FOREIGN KEY ("centerPaymentId") REFERENCES "CenterPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "FinanceTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherSalaryRate" ADD CONSTRAINT "TeacherSalaryRate_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeacherSalaryRate" ADD CONSTRAINT "TeacherSalaryRate_teacherMembershipId_fkey" FOREIGN KEY ("teacherMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherSalaryRate" ADD CONSTRAINT "TeacherSalaryRate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
