import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, studentId, inviteCode } = await req.json();

    // Action 1: Admin generates a parent invite code tied to a specific student
    if (action === "INITIATE_BY_ADMIN") {
      const tenantCtx = await requireTenantAccess();
      if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const studentMem = await db.centerMembership.findFirst({
        where: { id: studentId, centerId: tenantCtx.center.id, role: "STUDENT" },
        include: { user: true },
      });

      if (!studentMem) {
        return NextResponse.json({ error: "Ученик не найден" }, { status: 404 });
      }

      // Generate a parent invite code linked to this specific student
      const code = `PARENT-${studentMem.id.slice(0, 5).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const parentInvite = await db.inviteCode.create({
        data: {
          centerId: tenantCtx.center.id,
          code,
          targetRole: "PARENT",
          maxUses: 2, // Allow up to 2 parents (e.g. mom and dad)
          createdByMembershipId: tenantCtx.membership?.id || tenantCtx.center.ownerId,
        },
      });

      return NextResponse.json({
        success: true,
        parentInviteCode: code,
        studentName: studentMem.user.fullName,
        studentMembershipId: studentMem.id,
      });
    }

    // Action 2: Parent claims link using code
    if (action === "CLAIM_PARENT_LINK") {
      if (!inviteCode) {
        return NextResponse.json({ error: "Введите инвайт-код родителя" }, { status: 400 });
      }

      const codeObj = await db.inviteCode.findUnique({
        where: { code: inviteCode.toUpperCase().trim() },
        include: { center: true },
      });

      if (!codeObj || codeObj.targetRole !== "PARENT" || codeObj.isRevoked) {
        return NextResponse.json({ error: "Недействительный родительский код" }, { status: 400 });
      }

      // Ensure parent membership exists in center
      let parentMem = await db.centerMembership.findFirst({
        where: { userId: session.user.id, centerId: codeObj.centerId, role: "PARENT" },
      });

      if (!parentMem) {
        parentMem = await db.centerMembership.create({
          data: {
            userId: session.user.id,
            centerId: codeObj.centerId,
            role: "PARENT",
            status: "ACTIVE",
          },
        });
      }

      // Find student membership associated with creator or find target student if specified
      if (studentId) {
        const studentMem = await db.centerMembership.findFirst({
          where: { id: studentId, centerId: codeObj.centerId, role: "STUDENT" },
        });

        if (studentMem) {
          await db.parentLink.upsert({
            where: {
              parentMembershipId_studentMembershipId: {
                parentMembershipId: parentMem.id,
                studentMembershipId: studentMem.id,
              },
            },
            update: { status: "CONFIRMED", confirmedAt: new Date() },
            create: {
              parentMembershipId: parentMem.id,
              studentMembershipId: studentMem.id,
              status: "CONFIRMED",
              initiatedBy: "PARENT",
              inviteCodeUsed: inviteCode,
              confirmedAt: new Date(),
            },
          });
        }
      }

      return NextResponse.json({
        success: true,
        parentMembershipId: parentMem.id,
        centerName: codeObj.center.name,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка сервера" }, { status: 500 });
  }
}
