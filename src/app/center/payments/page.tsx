import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PaymentsManager from "@/components/PaymentsManager";
import { Prisma } from "@prisma/client";
import {
  calculateStudentBalances,
  StudentBalanceSummaryDTO,
} from "@/lib/student-balance";

export default async function CenterPaymentsPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = tenantCtx.center.id;
  const activeRole = tenantCtx.role || "";
  const currentMembership = tenantCtx.membership;

  const whereCondition: Prisma.CenterPaymentWhereInput = { centerId };
  const studentsWhereCondition: Prisma.CenterMembershipWhereInput = {
    centerId,
    role: "STUDENT",
  };
  let studentBalances: StudentBalanceSummaryDTO[] = [];

  if (activeRole === "STUDENT" && currentMembership) {
    whereCondition.studentMembershipId = currentMembership.id;
    studentsWhereCondition.id = currentMembership.id;
    studentBalances = await calculateStudentBalances({
      centerId,
      studentMembershipIds: [currentMembership.id],
    });
  } else if (activeRole === "PARENT" && currentMembership) {
    const childLinks = await tenantCtx.getTenantDb().parentLink.findMany({
      where: {
        parentMembershipId: currentMembership.id,
        status: "CONFIRMED",
      },
      select: { studentMembershipId: true },
    });
    const childIds = childLinks.map(
      (l: { studentMembershipId: string }) => l.studentMembershipId
    );
    whereCondition.studentMembershipId = { in: childIds };
    studentsWhereCondition.id = { in: childIds };
    studentBalances = await calculateStudentBalances({
      centerId,
      studentMembershipIds: childIds,
    });
  } else if (
    activeRole !== "DIRECTOR" &&
    activeRole !== "CENTER_ADMIN" &&
    activeRole !== "ACCOUNTANT" &&
    !tenantCtx.isPlatformStaff
  ) {
    redirect("/center");
  }

  const payments = await tenantCtx.getTenantDb().centerPayment.findMany({
    where: whereCondition,
    include: {
      student: {
        include: { user: { select: { fullName: true, email: true } } },
      },
      group: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const students = await tenantCtx.getTenantDb().centerMembership.findMany({
    where: studentsWhereCondition,
    include: { user: { select: { fullName: true, email: true } } },
  });

  const groups = await tenantCtx.getTenantDb().group.findMany({
    where: { course: { centerId } },
    select: { id: true, name: true },
  });

  return (
    <PaymentsManager
      initialPayments={payments}
      students={students}
      groups={groups}
      role={activeRole}
      studentBalances={studentBalances}
      centerName={tenantCtx.center.name}
    />
  );
}
