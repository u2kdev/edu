import { requireTenantAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { getTenantDb } from "@/lib/db-tenant";
import { redirect } from "next/navigation";
import InvitesManager from "@/components/InvitesManager";

export default async function CenterInvitesPage() {
  const tenantCtx = await requireTenantAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const invites = await getTenantDb(tenantCtx.center.id).inviteCode.findMany({
    where: { centerId },
    include: {
      course: { select: { title: true } },
      group: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const courses = await getTenantDb(tenantCtx.center.id).course.findMany({
    where: { centerId },
    select: { id: true, title: true },
  });

  const groups = await getTenantDb(tenantCtx.center.id).group.findMany({
    where: { course: { centerId } },
    select: { id: true, name: true },
  });

  return (
    <InvitesManager
      initialInvites={invites}
      courses={courses}
      groups={groups}
      role={session.activeCenterRole || ""}
    />
  );
}
