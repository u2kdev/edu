import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import StudentsManager from "@/components/StudentsManager";

export default async function CenterStudentsPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage || "ru";

  const groups = await tenantCtx.getTenantDb().group.findMany({
    where: { centerId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <StudentsManager
      initialGroups={groups}
      role={session.activeCenterRole || ""}
      locale={locale}
    />
  );
}
