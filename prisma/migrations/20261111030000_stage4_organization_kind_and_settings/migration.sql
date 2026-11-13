-- CreateEnum
CREATE TYPE "OrganizationKind" AS ENUM ('LEARNING_CENTER', 'SCHOOL', 'KINDERGARTEN', 'OTHER');

-- AlterTable
ALTER TABLE "LearningCenter" ADD COLUMN "organizationKind" "OrganizationKind" NOT NULL DEFAULT 'LEARNING_CENTER';
ALTER TABLE "LearningCenter" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "LearningCenter" ADD COLUMN "cancelledReason" TEXT;
ALTER TABLE "LearningCenter" ADD COLUMN "address" TEXT;
ALTER TABLE "LearningCenter" ADD COLUMN "inn" TEXT;
ALTER TABLE "LearningCenter" ADD COLUMN "legalName" TEXT;
ALTER TABLE "LearningCenter" ADD COLUMN "contactPerson" TEXT;

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key");

-- CreateIndex
CREATE INDEX "PlatformSetting_key_idx" ON "PlatformSetting"("key");
