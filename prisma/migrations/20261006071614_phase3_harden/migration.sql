/*
  Warnings:

  - Added the required column `expiresAt` to the `PendingInvite` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PendingInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "inviteCodeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PendingInvite_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PendingInvite" ("createdAt", "email", "id", "inviteCodeId", "status", "expiresAt") SELECT "createdAt", "email", "id", "inviteCodeId", "status", CURRENT_TIMESTAMP FROM "PendingInvite";
DROP TABLE "PendingInvite";
ALTER TABLE "new_PendingInvite" RENAME TO "PendingInvite";
CREATE INDEX "PendingInvite_email_idx" ON "PendingInvite"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
