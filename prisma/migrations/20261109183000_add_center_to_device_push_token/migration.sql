-- AlterTable
ALTER TABLE "DevicePushToken" ADD COLUMN "centerId" TEXT;

-- CreateIndex
CREATE INDEX "DevicePushToken_centerId_idx" ON "DevicePushToken"("centerId");

-- AddForeignKey
ALTER TABLE "DevicePushToken" ADD CONSTRAINT "DevicePushToken_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
