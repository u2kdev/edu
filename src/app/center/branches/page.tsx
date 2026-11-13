import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import BranchesManager from "@/components/BranchesManager";

export default async function BranchesPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const activeRole = session.activeCenterRole || "";

  // Only directors and admins can access branch management
  if (activeRole !== "DIRECTOR" && activeRole !== "CENTER_ADMIN") {
    redirect("/center");
  }

  const branches = await tenantCtx.getTenantDb().branch.findMany({
    where: { centerId },
    include: {
      _count: { select: { groups: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <BranchesManager
      initialBranches={branches.map((b) => ({
        ...b,
        createdAt: b.createdAt.toISOString(),
      }))}
      locale={session.user.preferredLanguage}
    />
  );
}
