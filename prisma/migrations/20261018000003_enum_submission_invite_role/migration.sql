-- AlterEnum
ALTER TYPE "SubmissionStatus" ADD VALUE IF NOT EXISTS 'REVISION_REQUESTED' BEFORE 'ACCEPTED';

-- AlterTable (data-preserving: cast existing text values into the new enum type)
ALTER TABLE "InviteCode"
    ALTER COLUMN "targetRole" DROP DEFAULT,
    ALTER COLUMN "targetRole" TYPE "MembershipRole" USING ("targetRole"::text::"MembershipRole"),
    ALTER COLUMN "targetRole" SET DEFAULT 'STUDENT'::"MembershipRole";
