import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";

const createTermSchema = z.object({
  name: z.string().min(2, "Название периода должно содержать минимум 2 символа").max(100),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Неверная дата начала" }),
  endDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Неверная дата окончания" }),
}).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
  message: "Дата окончания не может быть раньше даты начала",
  path: ["endDate"],
});

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    const terms = await tenantDb.academicTerm.findMany({
      where: { centerId: center.id },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ terms });
  } catch (err: unknown) {
    console.error("GET /api/tenant/academic-terms error:", err);
    return NextResponse.json({ error: "Не удалось загрузить учебные периоды" }, { status: 500 });
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
      return NextResponse.json({ error: "Forbidden: No permission to manage terms" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createTermSchema.parse(body);

    const term = await tenantDb.academicTerm.create({
      data: {
        centerId: center.id,
        name: parsed.name.trim(),
        startDate: new Date(parsed.startDate),
        endDate: new Date(parsed.endDate),
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "ACADEMIC_TERM_CREATED",
      resource: "AcademicTerm",
      resourceId: term.id,
      details: {
        name: term.name,
        startDate: term.startDate,
        endDate: term.endDate,
      },
    });

    return NextResponse.json({ success: true, term }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    console.error("POST /api/tenant/academic-terms error:", err);
    return NextResponse.json({ error: "Не удалось создать учебный период" }, { status: 500 });
  }
}
