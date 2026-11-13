import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CenterActivityManager } from "@/components/activity/CenterActivityManager";

export default async function CenterActivityPage() {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage;

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
      <CenterActivityManager locale={locale} />
    </div>
  );
}
