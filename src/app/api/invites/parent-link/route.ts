import { NextResponse } from "next/server";
// Reason: Exception: Invite validation requires global search before center context is known.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { getTenantDb } from "@/lib/db-tenant";

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, studentId, inviteCode } = await req.json();

    // Action 1: Admin generates a parent invite code tied to a specific student
    if (action === "INITIATE_BY_ADMIN") {
      const tenantCtx = await requireTenantAccess(req);
      const tenantDb = tenantCtx.getTenantDb();
      
      if (
        tenantCtx.role !== "DIRECTOR" &&
        tenantCtx.role !== "CENTER_ADMIN" &&
        !tenantCtx.isPlatformStaff
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const studentMem = await tenantDb.centerMembership.findFirst({
        where: { id: studentId, role: "STUDENT" },
        include: { user: true },
      });

      if (!studentMem) {
        return NextResponse.json({ error: "Ученик не найден" }, { status: 404 });
      }

      // Generate a parent invite code linked to this specific student
      const code = `PARENT-${studentMem.id.slice(0, 5).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      let createdByMembershipId = tenantCtx.membership?.id;
      if (!createdByMembershipId) {
        const directorMem = await tenantDb.centerMembership.findFirst({
          where: { role: "DIRECTOR" },
        });
        createdByMembershipId = directorMem?.id;
      }
      if (!createdByMembershipId) {
        return NextResponse.json({ error: "Could not resolve creator membership" }, { status: 403 });
      }

      const parentInvite = await tenantDb.inviteCode.create({
        data: {
          centerId: tenantCtx.center.id,
          code,
          targetRole: "PARENT",
          maxUses: 2, // Allow up to 2 parents (e.g. mom and dad)
          createdByMembershipId,
        },
      });

      return NextResponse.json({
        success: true,
        parentInviteCode: code,
        studentName: studentMem.user.fullName,
        studentMembershipId: studentMem.id,
      });
    }

    // Action 2: Parent claims link using code (cross tenant, before tenantCtx exists)
    if (action === "CLAIM_PARENT_LINK") {
      if (!inviteCode) {
        return NextResponse.json({ error: "Введите инвайт-код родителя" }, { status: 400 });
      }

      // eslint-disable-next-line no-restricted-imports
      const codeObj = await db.inviteCode.findUnique({
        where: { code: inviteCode.toUpperCase().trim() },
        include: { center: true },
      });

      if (!codeObj || codeObj.targetRole !== "PARENT" || codeObj.isRevoked) {
        return NextResponse.json({ error: "Недействительный родительский код" }, { status: 400 });
      }

      const tenantDb = getTenantDb(codeObj.centerId);

      // Ensure parent membership exists in center
      let parentMem = await tenantDb.centerMembership.findFirst({
        where: { userId: session.user.id, role: "PARENT" },
      });

      if (!parentMem) {
        parentMem = await tenantDb.centerMembership.create({
          data: {
            centerId: codeObj.centerId,
            userId: session.user.id,
            role: "PARENT",
            status: "ACTIVE",
          },
        });
      }

      // Find student membership associated with creator or find target student if specified
      if (studentId) {
        const studentMem = await tenantDb.centerMembership.findFirst({
          where: { id: studentId, role: "STUDENT" },
        });

        if (studentMem) {
          // Use updateMany simulation for upsert
          const existingLink = await tenantDb.parentLink.findFirst({
             where: { parentMembershipId: parentMem.id, studentMembershipId: studentMem.id }
          });
          
          if (existingLink) {
             await tenantDb.parentLink.updateMany({
               where: { parentMembershipId: parentMem.id, studentMembershipId: studentMem.id },
               data: { status: "CONFIRMED", confirmedAt: new Date() }
             });
          } else {
            try {
               await tenantDb.parentLink.create({
                 data: {
                   parentMembershipId: parentMem.id,
                   studentMembershipId: studentMem.id,
                   status: "CONFIRMED",
                   initiatedBy: "PARENT",
                   inviteCodeUsed: inviteCode,
                   confirmedAt: new Date(),
                 }
               });
            } catch (e: unknown) {
              const error = e as { code?: string };
              if (error.code === 'P2002') {
                await tenantDb.parentLink.updateMany({
                  where: { parentMembershipId: parentMem.id, studentMembershipId: studentMem.id },
                  data: { status: "CONFIRMED", confirmedAt: new Date() }
                });
              } else {
                throw e;
              }
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        parentMembershipId: parentMem.id,
        centerName: codeObj.center.name,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json({ error: error.message || "Ошибка сервера" }, { status: error.status || 500 });
  }
}
