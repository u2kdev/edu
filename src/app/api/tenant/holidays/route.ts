import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";
import { getUzbekistanOfficialHolidays } from "@/lib/calendar-holidays";

const createHolidaySchema = z.object({
  action: z.enum(["CREATE", "IMPORT_UZ_HOLIDAYS"]).optional().default("CREATE"),
  name: z.string().min(2, "Название праздника должно содержать минимум 2 символа").max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  year: z.number().int().min(2020).max(2035).optional(),
});

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    const holidays = await tenantDb.holiday.findMany({
      where: { centerId: center.id },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ holidays });
  } catch (err: unknown) {
    console.error("GET /api/tenant/holidays error:", err);
    return NextResponse.json({ error: "Не удалось загрузить праздники" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    const canManage =
      tenantCtx.isPlatformStaff ||
      hasPermission("settings.manage", session.user.platformRole, actorRole as CenterRole) ||
      actorRole === "DIRECTOR" ||
      actorRole === "CENTER_ADMIN";

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden: No permission to manage holidays" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createHolidaySchema.parse(body);

    // 1. One-click Import Uzbekistan Official Holidays
    if (parsed.action === "IMPORT_UZ_HOLIDAYS") {
      const year = parsed.year || new Date().getFullYear();
      const officialList = getUzbekistanOfficialHolidays(year);

      let createdCount = 0;
      for (const h of officialList) {
        const start = new Date(h.startDate);
        const end = new Date(h.endDate);

        // Avoid exact duplicate
        const exists = await tenantDb.holiday.findFirst({
          where: {
            centerId: center.id,
            name: h.name,
            startDate: start,
          },
        });

        if (!exists) {
          await tenantDb.holiday.create({
            data: {
              centerId: center.id,
              name: h.name,
              startDate: start,
              endDate: end,
            },
          });
          createdCount++;
        }
      }

      await logAuditEvent({
        centerId: center.id,
        actorUserId: session.user.id,
        action: "IMPORT_UZ_HOLIDAYS",
        resource: "Holiday",
        details: { year, createdCount },
      });

      const updatedList = await tenantDb.holiday.findMany({
        where: { centerId: center.id },
        orderBy: { startDate: "asc" },
      });

      return NextResponse.json({
        success: true,
        createdCount,
        message: `Импортировано официальных праздников: ${createdCount}`,
        holidays: updatedList,
      });
    }

    // 2. Custom holiday creation
    if (!parsed.name || !parsed.startDate) {
      return NextResponse.json(
        { error: "Необходимо указать название и дату праздника" },
        { status: 400 }
      );
    }

    const start = new Date(parsed.startDate);
    const end = parsed.endDate ? new Date(parsed.endDate) : start;

    if (end < start) {
      return NextResponse.json(
        { error: "Дата окончания не может быть раньше даты начала" },
        { status: 400 }
      );
    }

    const holiday = await tenantDb.holiday.create({
      data: {
        centerId: center.id,
        name: parsed.name.trim(),
        startDate: start,
        endDate: end,
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "HOLIDAY_CREATED",
      resource: "Holiday",
      resourceId: holiday.id,
      details: { name: holiday.name, startDate: holiday.startDate, endDate: holiday.endDate },
    });

    return NextResponse.json({ success: true, holiday }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    console.error("POST /api/tenant/holidays error:", err);
    return NextResponse.json({ error: "Не удалось сохранить праздник" }, { status: 500 });
  }
}
