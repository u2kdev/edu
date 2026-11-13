import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";

const reorderSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      orderIndex: z.number().int(),
    })
  ).min(1),
});

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    const canManage =
      tenantCtx.isPlatformStaff ||
      hasPermission("courses.manage", session.user.platformRole, actorRole as CenterRole) ||
      actorRole === "TEACHER";

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden: No permission" }, { status: 403 });
    }

    const body = await req.json();
    const { items } = reorderSchema.parse(body);

    for (const item of items) {
      await tenantDb.courseModule.updateMany({
        where: { id: item.id, centerId: center.id },
        data: { orderIndex: item.orderIndex },
      });
    }

    return NextResponse.json({ success: true, updatedCount: items.length });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    console.error("POST /api/modules/reorder error:", err);
    return NextResponse.json({ error: "Не удалось изменить порядок модулей" }, { status: 500 });
  }
}
