-- CreateTable
CREATE TABLE "PendingInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "inviteCodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingInvite_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode" ("id") ON DELETE CASCADE ON UPDATE "PlatformUser" SET "emailVerified" = CURRENT_TIMESTAMP WHERE "emailVerified" IS NULL;
);

-- CreateIndex
CREATE INDEX "PendingInvite_email_idx" ON "PendingInvite"("email");
  
-- Backfill emailVerified  
UPDATE "PlatformUser" SET "emailVerified" = CURRENT_TIMESTAMP WHERE "emailVerified" IS NULL;
