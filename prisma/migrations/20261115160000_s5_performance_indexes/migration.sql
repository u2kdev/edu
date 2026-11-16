-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_status_currentPeriodEndsAt_idx" ON "Subscription"("status", "currentPeriodEndsAt");
