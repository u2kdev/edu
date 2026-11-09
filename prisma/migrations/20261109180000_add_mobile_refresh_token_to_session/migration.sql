-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN "refreshTokenHash" TEXT;
ALTER TABLE "UserSession" ADD COLUMN "deviceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_refreshTokenHash_key" ON "UserSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "UserSession_refreshTokenHash_idx" ON "UserSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "UserSession_deviceId_idx" ON "UserSession"("deviceId");
