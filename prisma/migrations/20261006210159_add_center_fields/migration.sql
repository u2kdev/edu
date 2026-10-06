-- AlterTable
ALTER TABLE "LearningCenter" ADD COLUMN "email" TEXT;
ALTER TABLE "LearningCenter" ADD COLUMN "phone" TEXT;
ALTER TABLE "LearningCenter" ADD COLUMN "suspensionReason" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InviteCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "centerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL DEFAULT 'STUDENT',
    "courseId" TEXT,
    "groupId" TEXT,
    "maxUses" INTEGER,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "createdByMembershipId" TEXT NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InviteCode_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InviteCode_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "CenterMembership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InviteCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InviteCode_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InviteCode" ("centerId", "code", "courseId", "createdAt", "createdByMembershipId", "expiresAt", "groupId", "id", "isRevoked", "maxUses", "targetRole", "updatedAt", "usesCount") SELECT "centerId", "code", "courseId", "createdAt", "createdByMembershipId", "expiresAt", "groupId", "id", "isRevoked", "maxUses", "targetRole", "updatedAt", "usesCount" FROM "InviteCode";
DROP TABLE "InviteCode";
ALTER TABLE "new_InviteCode" RENAME TO "InviteCode";
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");
CREATE INDEX "InviteCode_code_idx" ON "InviteCode"("code");
CREATE INDEX "InviteCode_centerId_idx" ON "InviteCode"("centerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
