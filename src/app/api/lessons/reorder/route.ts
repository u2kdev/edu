import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess } from "@/lib/tenant";

// POST /api/lessons/reorder - Update orderIndex for multiple lessons in batch
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { items } = await req.json(); // Array of { id: string, orderIndex: number }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid payload: items array required" }, { status: 400 });
    }

    // tenantDb.$transaction isn't fully mocked for array of updateMany yet in some proxy setups, but we'll try sequential updateMany
    for (const item of items) {
       await tenantDb.lesson.updateMany({
         where: { id: item.id },
         data: { orderIndex: item.orderIndex },
       });
    }

    return NextResponse.json({ success: true, updatedCount: items.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
