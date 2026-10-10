-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_studentMembershipId_fkey";

-- DropForeignKey
ALTER TABLE "Grade" DROP CONSTRAINT "Grade_studentMembershipId_fkey";

-- DropForeignKey
ALTER TABLE "CenterPayment" DROP CONSTRAINT "CenterPayment_studentMembershipId_fkey";

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterPayment" ADD CONSTRAINT "CenterPayment_studentMembershipId_fkey" FOREIGN KEY ("studentMembershipId") REFERENCES "CenterMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
