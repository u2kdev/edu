-- Add dual-entry transfer fields and lesson salary uniqueness to FinanceTransaction
ALTER TABLE "FinanceTransaction" ADD COLUMN "lessonId" TEXT;
ALTER TABLE "FinanceTransaction" ADD COLUMN "transferGroupId" TEXT;
ALTER TABLE "FinanceTransaction" ADD COLUMN "transferDirection" TEXT;

CREATE UNIQUE INDEX "FinanceTransaction_lessonId_isReversal_key" ON "FinanceTransaction"("lessonId", "isReversal");
CREATE INDEX "FinanceTransaction_lessonId_idx" ON "FinanceTransaction"("lessonId");
CREATE INDEX "FinanceTransaction_transferGroupId_idx" ON "FinanceTransaction"("transferGroupId");

ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
