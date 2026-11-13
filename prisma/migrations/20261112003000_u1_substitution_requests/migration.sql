-- CreateEnum
CREATE TYPE "SubstitutionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SubstitutionRequest" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "requesterMembershipId" TEXT NOT NULL,
    "proposedSubstituteMembershipId" TEXT,
    "substituteTeacherMembershipId" TEXT,
    "status" "SubstitutionStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "resolvedByMembershipId" TEXT,
    "resolverComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubstitutionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubstitutionRequest_centerId_idx" ON "SubstitutionRequest"("centerId");
CREATE INDEX "SubstitutionRequest_lessonId_idx" ON "SubstitutionRequest"("lessonId");
CREATE INDEX "SubstitutionRequest_requesterMembershipId_idx" ON "SubstitutionRequest"("requesterMembershipId");
CREATE INDEX "SubstitutionRequest_status_idx" ON "SubstitutionRequest"("status");

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "LearningCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_requesterMembershipId_fkey" FOREIGN KEY ("requesterMembershipId") REFERENCES "CenterMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_proposedSubstituteMembershipId_fkey" FOREIGN KEY ("proposedSubstituteMembershipId") REFERENCES "CenterMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_substituteTeacherMembershipId_fkey" FOREIGN KEY ("substituteTeacherMembershipId") REFERENCES "CenterMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_resolvedByMembershipId_fkey" FOREIGN KEY ("resolvedByMembershipId") REFERENCES "CenterMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
