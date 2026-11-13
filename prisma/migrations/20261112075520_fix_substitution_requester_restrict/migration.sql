-- DropForeignKey
ALTER TABLE "SubstitutionRequest" DROP CONSTRAINT "SubstitutionRequest_requesterMembershipId_fkey";

-- AddForeignKey
ALTER TABLE "SubstitutionRequest" ADD CONSTRAINT "SubstitutionRequest_requesterMembershipId_fkey" FOREIGN KEY ("requesterMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
