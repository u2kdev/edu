import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import PaymentsManager from "@/components/PaymentsManager";
import { Prisma } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";
import { getSelectedParentChildIds } from "@/lib/parent-child";
import {
  calculateStudentBalances,
  StudentBalanceSummaryDTO,
} from "@/lib/student-balance";

export default async function CenterPaymentsPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = tenantCtx?.center?.id || session.activeCenterId;
  if (!centerId) redirect("/center");

  const activeRole = tenantCtx?.role || session.activeCenterRole || "";
  const currentMembership =
    tenantCtx?.membership ||
    session.memberships?.find((m: { centerId: string }) => m.centerId === centerId);

  const whereCondition: Prisma.CenterPaymentWhereInput = { centerId, deletedAt: null };
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
    const childIds = getSelectedParentChildIds(
      childLinks.map((l: { studentMembershipId: string }) => l.studentMembershipId)
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
  } else {
    studentBalances = await calculateStudentBalances({ centerId });
  }

  const tenantDb = tenantCtx.getTenantDb();

  const [payments, students, groups, centerSettings, merchantConfig] = await Promise.all([
    tenantDb.centerPayment.findMany({
      where: whereCondition,
      include: {
        student: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        group: { select: { name: true } },
        promoCode: { select: { code: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    tenantDb.centerMembership.findMany({
      where: studentsWhereCondition,
      include: {
        user: { select: { fullName: true, email: true } },
        enrollments: {
          where: { status: { in: ["ACTIVE", "FROZEN"] } },
          select: { id: true, groupId: true, paidUntil: true, status: true },
        },
      },
    }),
    tenantDb.group.findMany({
      where: { course: { centerId } },
      select: {
        id: true,
        name: true,
        course: { select: { id: true, title: true, priceMonthly: true } },
        pricingPlans: {
          where: { isActive: true },
          select: { periodMonths: true, price: true },
          orderBy: { periodMonths: "asc" },
        },
      },
    }),
    tenantDb.learningCenter.findUnique({
      where: { id: centerId },
      select: { name: true, allowAdminDiscount: true },
    }),
    tenantDb.centerMerchantConfig.findFirst({
      where: { centerId },
      select: { isVerified: true },
    }),
  ]);

  const canDiscount = hasPermission(
    "payments.discount",
    session.user.platformRole,
    activeRole
  );
  const canRefund = hasPermission(
    "payments.refund",
    session.user.platformRole,
    activeRole
  );

  return (
    <PaymentsManager
      initialPayments={payments}
      students={students}
      groups={groups}
      role={activeRole}
      studentBalances={studentBalances}
      centerName={centerSettings?.name || tenantCtx.center?.name || ""}
      canDiscount={canDiscount}
      canRefund={canRefund}
      allowAdminDiscount={centerSettings?.allowAdminDiscount ?? true}
      merchantVerified={Boolean(merchantConfig?.isVerified)}
    />
  );
}
