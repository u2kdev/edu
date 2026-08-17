import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/tenant";

function generateRandomCode(length: number = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    
    // Only Director and Center Admin can generate invite codes
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав для создания инвайт-кода" }, { status: 403 });
    }

    const { targetRole, courseId, groupId, maxUses, customCode } = await req.json();

    const code = customCode
      ? customCode.toUpperCase().trim()
      : `${tenantCtx.center.slug.toUpperCase()}-${generateRandomCode(6)}`;

    const existing = await db.inviteCode.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ error: "Такой инвайт-код уже существует" }, { status: 400 });
    }

    const invite = await db.inviteCode.create({
      data: {
        centerId: tenantCtx.center.id,
        code,
        targetRole: targetRole || "STUDENT",
        courseId: courseId || null,
        groupId: groupId || null,
        maxUses: maxUses ? parseInt(maxUses) : 10,
        createdByMembershipId: tenantCtx.membership?.id || tenantCtx.center.ownerId,
      },
      include: {
        course: { select: { title: true } },
        group: { select: { name: true } },
      },
    });

    return NextResponse.json({ success: true, invite });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка при генерации инвайта" }, { status: 400 });
  }
}
