import { requireTenantAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import InvitesManager from "@/components/InvitesManager";

export default async function CenterInvitesPage() {
  const tenantCtx = await requireTenantAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const invites = await tenantCtx.getTenantDb().inviteCode.findMany({
    where: { centerId },
    include: {
      course: { select: { title: true } },
      group: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const courses = await tenantCtx.getTenantDb().course.findMany({
    where: { centerId },
    select: { id: true, title: true },
  });

  const groups = await tenantCtx.getTenantDb().group.findMany({
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
