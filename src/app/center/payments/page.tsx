import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import PaymentsManager from "@/components/PaymentsManager";

export default async function CenterPaymentsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const activeRole = session.activeCenterRole || "";
  const currentMembership = session.memberships.find(m => m.centerId === centerId);

  let whereCondition: any = { centerId };
  let studentsWhereCondition: any = { centerId, role: "STUDENT" };

  if (activeRole === "STUDENT" && currentMembership) {
    whereCondition.studentMembershipId = currentMembership.id;
    studentsWhereCondition.id = currentMembership.id;
  } else if (activeRole === "PARENT" && currentMembership) {
    const childLinks = await db.parentLink.findMany({
      where: { parentMembershipId: currentMembership.id, status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    const childIds = childLinks.map(l => l.studentMembershipId);
    whereCondition.studentMembershipId = { in: childIds };
    studentsWhereCondition.id = { in: childIds };
  } else if (activeRole !== "DIRECTOR" && activeRole !== "CENTER_ADMIN" && !session.user.platformRole) {
    // Other roles like TEACHER should not have access to all payments
    redirect("/center");
  }

  const payments = await db.centerPayment.findMany({
    where: whereCondition,
    include: {
      student: { include: { user: { select: { fullName: true, email: true } } } },
      group: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const students = await db.centerMembership.findMany({
    where: studentsWhereCondition,
    include: { user: { select: { fullName: true, email: true } } },
  });

  const groups = await db.group.findMany({
    where: { course: { centerId } },
    select: { id: true, name: true },
  });

  return (
    <PaymentsManager
      initialPayments={payments}
      students={students}
      groups={groups}
      role={session.activeCenterRole || ""}
    />
  );
}
