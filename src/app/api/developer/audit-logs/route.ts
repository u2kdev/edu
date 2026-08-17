import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDeveloper, handlePlatformError } from "@/lib/platformAuth";

export async function GET(req: Request) {
  try {
    await requireDeveloper();
    const { searchParams } = new URL(req.url);
    const take = Number(searchParams.get("limit")) || 100;
    const centerId = searchParams.get("centerId");
    
    let whereClause: any = {};
    if (centerId) {
      whereClause.centerId = centerId;
    }

    const logs = await db.auditLog.findMany({
      where: whereClause,
      include: {
        actor: { select: { fullName: true, email: true, platformRole: true } },
        center: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json({ logs });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}
