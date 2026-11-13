-- AlterTable
ALTER TABLE "ParentLink" ADD COLUMN IF NOT EXISTS "relationship" TEXT;

-- AlterTable
ALTER TABLE "InviteCode" ADD COLUMN IF NOT EXISTS "studentMembershipId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InviteCode_studentMembershipId_idx" ON "InviteCode"("studentMembershipId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InviteCode_studentMembershipId_fkey'
  ) THEN
    ALTER TABLE "InviteCode" ADD CONSTRAINT "InviteCode_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
