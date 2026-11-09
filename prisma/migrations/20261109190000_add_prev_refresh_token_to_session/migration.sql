-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN "prevRefreshTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_prevRefreshTokenHash_key" ON "UserSession"("prevRefreshTokenHash");

-- CreateIndex
CREATE INDEX "UserSession_prevRefreshTokenHash_idx" ON "UserSession"("prevRefreshTokenHash");
