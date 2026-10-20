-- CreateTable
CREATE TABLE "RateLimitRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RateLimitRecord_key_key" ON "RateLimitRecord"("key");

-- CreateIndex
CREATE INDEX "RateLimitRecord_key_idx" ON "RateLimitRecord"("key");

-- CreateIndex
CREATE INDEX "RateLimitRecord_expiresAt_idx" ON "RateLimitRecord"("expiresAt");
