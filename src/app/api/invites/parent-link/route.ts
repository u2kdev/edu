import { NextResponse } from "next/server";
import crypto from "crypto";
// Reason: Exception: Invite validation requires global search before center context is known.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { requireTenantAccess } from "@/lib/tenant";
import { generateSecureInviteCode } from "@/lib/invites";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
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
        include: { user: { select: { fullName: true } } },
      });

      if (!studentMem) {
        return NextResponse.json({ error: "Ученик не найден" }, { status: 404 });
      }

      // Generate a CSPRNG parent invite code and store only its SHA-256 hash in the DB
      const plaintextCode = `PARENT-${generateSecureInviteCode(16)}`;
      const codeHash = crypto
        .createHash("sha256")
        .update(plaintextCode.toUpperCase().trim())
        .digest("hex");

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

      // 30 days expiry by default
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await tenantDb.inviteCode.create({
        data: {
          centerId: tenantCtx.center.id,
          code: codeHash,
          targetRole: "PARENT",
          studentMembershipId: studentMem.id,
          maxUses: 2, // Allow up to 2 parents (e.g. mom and dad)
          expiresAt,
          createdByMembershipId,
        },
      });

      return NextResponse.json({
        success: true,
        parentInviteCode: plaintextCode,
        expiresAt,
        studentName: studentMem.user.fullName,
        studentMembershipId: studentMem.id,
      });
    }

    // Action 2: Parent claims link using code (cross tenant, before tenantCtx exists)
    if (action === "CLAIM_PARENT_LINK") {
      const ip = getClientIp(req);
      const rlKey = `parent-link-claim:${session.user.id}:${ip}`;
      if (!(await checkRateLimit(rlKey, 8, 60000))) {
        return NextResponse.json(
          { error: "Слишком много попыток. Попробуйте позже." },
          { status: 429 }
        );
      }

      if (!inviteCode || typeof inviteCode !== "string") {
        return NextResponse.json({ error: "Введите инвайт-код родителя" }, { status: 400 });
      }

      const cleanCode = inviteCode.toUpperCase().trim();
      const codeHash = crypto.createHash("sha256").update(cleanCode).digest("hex");

      const codeObj = await db.inviteCode.findFirst({
        where: {
          code: { in: [codeHash, cleanCode] },
        },
        include: { center: true },
      });

      if (
        !codeObj ||
        codeObj.targetRole !== "PARENT" ||
        codeObj.isRevoked ||
        (codeObj.expiresAt && new Date() > codeObj.expiresAt) ||
        (codeObj.maxUses !== null && codeObj.usesCount >= codeObj.maxUses) ||
        !codeObj.studentMembershipId
      ) {
        return NextResponse.json({ error: "Недействительный родительский код" }, { status: 400 });
      }

      if (codeObj.center.status === "BLOCKED" || codeObj.center.status === "CANCELLED") {
        return NextResponse.json(
          { error: "Учебный центр заблокирован или деактивирован" },
          { status: 403 }
        );
      }

      const boundStudentId = codeObj.studentMembershipId;

      const result = await db.$transaction(async (tx) => {
        // Verify student belongs to this center and is ACTIVE
        const studentMem = await tx.centerMembership.findFirst({
          where: {
            id: boundStudentId,
            centerId: codeObj.centerId,
            role: "STUDENT",
            status: "ACTIVE",
          },
        });

        if (!studentMem) {
          throw new Error("INVALID_STUDENT");
        }

        // Atomic conditional increment of usesCount
        const affected = await tx.$executeRaw`
          UPDATE "InviteCode"
          SET "usesCount" = "usesCount" + 1
          WHERE "id" = ${codeObj.id}
            AND "isRevoked" = false
            AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
            AND ("maxUses" IS NULL OR "usesCount" < "maxUses")
        `;

        if (affected === 0) {
          throw new Error("CODE_EXHAUSTED_OR_INVALID");
        }

        // Ensure parent membership exists in center
        let parentMem = await tx.centerMembership.findFirst({
          where: { centerId: codeObj.centerId, userId: session.user.id, role: "PARENT" },
        });

        if (!parentMem) {
          parentMem = await tx.centerMembership.create({
            data: {
              centerId: codeObj.centerId,
              userId: session.user.id,
              role: "PARENT",
              status: "ACTIVE",
            },
          });
        }

        const existingLink = await tx.parentLink.findFirst({
          where: { parentMembershipId: parentMem.id, studentMembershipId: studentMem.id },
        });

        if (existingLink) {
          await tx.parentLink.updateMany({
            where: { parentMembershipId: parentMem.id, studentMembershipId: studentMem.id },
            data: {
              status: "CONFIRMED",
              confirmedAt: new Date(),
              inviteCodeUsed: codeHash,
            },
          });
        } else {
          await tx.parentLink.create({
            data: {
              parentMembershipId: parentMem.id,
              studentMembershipId: studentMem.id,
              status: "CONFIRMED",
              initiatedBy: "PARENT",
              inviteCodeUsed: codeHash,
              confirmedAt: new Date(),
            },
          });
        }

        return parentMem;
      });

      return NextResponse.json({
        success: true,
        parentMembershipId: result.id,
        centerName: codeObj.center.name,
      });
    }

    // Action 3: Admin revokes a parent invite code
    if (action === "REVOKE_PARENT_CODE") {
      const tenantCtx = await requireTenantAccess(req);
      const tenantDb = tenantCtx.getTenantDb();

      if (
        tenantCtx.role !== "DIRECTOR" &&
        tenantCtx.role !== "CENTER_ADMIN" &&
        !tenantCtx.isPlatformStaff
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (!inviteCode || typeof inviteCode !== "string") {
        return NextResponse.json({ error: "Не указан код для отзыва" }, { status: 400 });
      }

      const cleanCode = inviteCode.toUpperCase().trim();
      const codeHash = crypto.createHash("sha256").update(cleanCode).digest("hex");

      await tenantDb.inviteCode.updateMany({
        where: {
          centerId: tenantCtx.center.id,
          code: { in: [codeHash, cleanCode] },
        },
        data: { isRevoked: true },
      });

      return NextResponse.json({ success: true, message: "Код успешно отозван" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === "CODE_EXHAUSTED_OR_INVALID" || err.message === "INVALID_STUDENT") {
        return NextResponse.json({ error: "Недействительный родительский код" }, { status: 400 });
      }
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Ошибка сервера" },
      { status: error.status || 500 }
    );
  }
}
