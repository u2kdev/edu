import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, TenantAccessError } from "@/lib/tenant";
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

    const body = await req.json();
    const { items } = reorderSchema.parse(body);

    const hasGlobalManage =
      tenantCtx.isPlatformStaff ||
      hasPermission("courses.manage", session.user.platformRole, actorRole as CenterRole);

    if (!hasGlobalManage) {
      if (
        (actorRole === "TEACHER" || actorRole === "TEACHER_ASSISTANT") &&
        tenantCtx.membership?.id
      ) {
        const itemIds = items.map((i) => i.id);
        const modules = await tenantDb.courseModule.findMany({
          where: { id: { in: itemIds }, centerId: center.id },
          select: { courseId: true },
        });
        const courseIds = Array.from(new Set(modules.map((m) => m.courseId)));
        const assignedGroups = await tenantDb.group.findMany({
          where: {
            centerId: center.id,
            courseId: { in: courseIds },
            ...(actorRole === "TEACHER"
              ? { teacherMembershipId: tenantCtx.membership.id }
              : { assistantMembershipId: tenantCtx.membership.id }),
          },
          select: { courseId: true },
        });
        const assignedCourseIds = new Set(assignedGroups.map((g) => g.courseId));
        const allAssigned = courseIds.length > 0 && courseIds.every((cid) => assignedCourseIds.has(cid));
        if (!allAssigned) {
          return NextResponse.json(
            { error: "Forbidden: You are not assigned to all reordered courses" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json({ error: "Forbidden: No permission" }, { status: 403 });
      }
    }

    for (const item of items) {
      await tenantDb.courseModule.updateMany({
        where: { id: item.id, centerId: center.id },
        data: { orderIndex: item.orderIndex },
      });
    }

    return NextResponse.json({ success: true, updatedCount: items.length });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    console.error("POST /api/modules/reorder error:", err);
    return NextResponse.json({ error: "Не удалось изменить порядок модулей" }, { status: 500 });
  }
}
