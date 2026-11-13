import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ParentsManager, type ParentItem } from "@/components/parents/ParentsManager";

export default async function CenterParentsPage() {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const actorRole = session.activeCenterRole || "";
  const locale = session.user.preferredLanguage || "ru";

  if (actorRole !== "DIRECTOR" && actorRole !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
    redirect("/center");
  }

  const tenantDb = tenantCtx.getTenantDb();

  // Find all parent memberships in this center
  const parentMemberships = await tenantDb.centerMembership.findMany({
    where: {
      centerId: tenantCtx.center.id,
      role: "PARENT",
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          lastLoginAt: true,
        },
      },
      parentLinksAsParent: {
        where: { status: "CONFIRMED" },
        include: {
          student: {
            include: {
              user: {
                select: { fullName: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedParents: ParentItem[] = parentMemberships.map((p) => {
    const isSyntheticEmail = p.user.email.endsWith("@noemail.local");
    return {
      id: p.id,
      userId: p.user.id,
      fullName: p.user.fullName,
      phone: p.user.phone,
      email: isSyntheticEmail ? null : p.user.email,
      status: p.status,
      lastLoginAt: p.user.lastLoginAt ? p.user.lastLoginAt.toISOString() : null,
      children: p.parentLinksAsParent.map((l) => ({
        id: l.student.id,
        fullName: l.student.user.fullName,
        relationship: l.relationship,
      })),
    };
  });

  return (
    <ParentsManager
      initialParents={formattedParents}
      locale={locale}
      role={actorRole}
    />
  );
}
