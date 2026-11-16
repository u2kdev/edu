import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import CenterSupportList from "@/components/CenterSupportList";

export default async function CenterSupportPage() {
  const tenantCtx = await requireTenantPageAccess({ allowSuspended: true });

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage || "ru";

  const isCenterAdminOrDirector =
    session.activeCenterRole === "DIRECTOR" ||
    session.activeCenterRole === "CENTER_ADMIN" ||
    session.activeCenterRole === "CENTER_SUPPORT" ||
    tenantCtx.isPlatformStaff;

  const tickets = await tenantCtx.getTenantDb().supportTicket.findMany({
    where: isCenterAdminOrDirector
      ? { centerId }
      : { creatorUserId: session.user.id, centerId },
    include: {
      creator: { select: { fullName: true, email: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <CenterSupportList
      initialTickets={tickets.map((t) => ({
        ...t,
        createdAt:
          typeof t.createdAt === "string"
            ? t.createdAt
            : t.createdAt?.toISOString?.() || new Date().toISOString(),
        updatedAt:
          typeof t.updatedAt === "string"
            ? t.updatedAt
            : t.updatedAt?.toISOString?.() || new Date().toISOString(),
      }))}
      locale={locale}
    />
  );
}
