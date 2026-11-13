import { redirect } from "next/navigation";
import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";
import AcademicCalendarManager, {
  type AcademicTermItem,
  type HolidayItem,
} from "@/components/calendar/AcademicCalendarManager";

export default async function CenterCalendarSettingsPage() {
  const tenantCtx = await requireTenantPageAccess();
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const tenantDb = tenantCtx.getTenantDb();

  const [terms, holidays] = await Promise.all([
    tenantDb.academicTerm.findMany({
      where: { centerId },
      orderBy: { startDate: "asc" },
    }),
    tenantDb.holiday.findMany({
      where: { centerId },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const role = session.activeCenterRole as CenterRole;
  const canManage =
    tenantCtx.isPlatformStaff ||
    hasPermission("settings.manage", session.user.platformRole, role) ||
    role === "DIRECTOR" ||
    role === "CENTER_ADMIN";

  const formattedTerms: AcademicTermItem[] = terms.map((t) => ({
    id: t.id,
    name: t.name,
    startDate: t.startDate.toISOString(),
    endDate: t.endDate.toISOString(),
  }));

  const formattedHolidays: HolidayItem[] = holidays.map((h) => ({
    id: h.id,
    name: h.name,
    startDate: h.startDate.toISOString(),
    endDate: h.endDate.toISOString(),
  }));

  return (
    <AcademicCalendarManager
      initialTerms={formattedTerms}
      initialHolidays={formattedHolidays}
      canManage={canManage}
    />
  );
}
