export const dynamic = "force-dynamic";

import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import MySalaryManager from "@/components/salary/MySalaryManager";

export default async function CenterMySalaryPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const role = session.activeCenterRole || "";
  if (role !== "TEACHER" && role !== "TEACHER_ASSISTANT" && role !== "DIRECTOR" && role !== "CENTER_ADMIN") {
    redirect("/center");
  }

  const locale = session.user.preferredLanguage || "ru";

  return <MySalaryManager role={role} locale={locale} />;
}
