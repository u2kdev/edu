import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/tenant";

// POST /api/lessons/reorder - Update orderIndex for multiple lessons in batch
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { items } = await req.json(); // Array of { id: string, orderIndex: number }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid payload: items array required" }, { status: 400 });
    }

    const updates = items.map((item) =>
      db.lesson.update({
        where: { id: item.id },
        data: { orderIndex: item.orderIndex },
      })
    );

    await db.$transaction(updates);

    return NextResponse.json({ success: true, updatedCount: items.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
