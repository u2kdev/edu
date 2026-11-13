import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Bulk user creation operates on platform user models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";
import { checkSubscriptionLimit } from "@/lib/limits";
import { normalizePhone, isValidUsername } from "@/lib/phone";
import { generateSecurePassword } from "@/lib/generatePassword";
import { canActorManageRole } from "@/lib/tenant-user-guard";
import type { MembershipRole, Language } from "@prisma/client";

const bulkUserSchema = z.object({
  users: z.array(
    z.object({
      fullName: z.string().min(2, "Имя должно содержать минимум 2 символа"),
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      username: z.string().optional().nullable(),
      preferredLanguage: z.enum(["ru", "uz-Latn"]).optional().default("ru"),
      role: z.enum([
        "DIRECTOR",
        "CENTER_ADMIN",
        "ACCOUNTANT",
        "TEACHER",
        "TEACHER_ASSISTANT",
        "CENTER_SUPPORT",
        "STUDENT",
        "PARENT",
      ]),
      groupId: z.string().optional().nullable(),
    })
  ).min(1, "Список пользователей не может быть пустым").max(100, "Максимум 100 пользователей за раз"),
});

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const actorUser = session.user;
    const tenantDb = tenantCtx.getTenantDb();

    if (!hasPermission("users.create", session.user.platformRole, actorRole as CenterRole) && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden: No permission to create users" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = bulkUserSchema.parse(body);

    const studentCount = parsed.users.filter((u) => u.role === "STUDENT").length;
    const teacherCount = parsed.users.filter((u) => u.role === "TEACHER" || u.role === "TEACHER_ASSISTANT").length;

    if (studentCount > 0) {
      const allowed = await checkSubscriptionLimit(center.id, "students", studentCount);
      if (!allowed) {
        return NextResponse.json(
          { error: `Превышен лимит студентов по тарифу подписки (требуется: ${studentCount})`, code: "PLAN_LIMIT_REACHED" },
          { status: 400 }
        );
      }
    }

    if (teacherCount > 0) {
      const allowed = await checkSubscriptionLimit(center.id, "teachers", teacherCount);
      if (!allowed) {
        return NextResponse.json(
          { error: `Превышен лимит преподавателей по тарифу подписки (требуется: ${teacherCount})`, code: "PLAN_LIMIT_REACHED" },
          { status: 400 }
        );
      }
    }

    const results: Array<{
      login: string;
      password: string;
      fullName: string;
      role: string;
      status: "CREATED" | "EXISTING_LINKED" | "SKIPPED";
      error?: string;
    }> = [];

    const baseUrl = process.env.NEXTAUTH_URL || "https://e-darschi.uz";
    const loginUrl = `${baseUrl}/login`;

    for (const item of parsed.users) {
      const roleCheck = canActorManageRole(actorRole, item.role, tenantCtx.isPlatformStaff);
      if (!roleCheck.allowed) {
        results.push({
          login: item.email || item.phone || item.fullName,
          password: "",
          fullName: item.fullName,
          role: item.role,
          status: "SKIPPED",
          error: roleCheck.reason,
        });
        continue;
      }

      if (!item.email && !item.phone) {
        results.push({
          login: item.fullName,
          password: "",
          fullName: item.fullName,
          role: item.role,
          status: "SKIPPED",
          error: "Не указан email или телефон",
        });
        continue;
      }

      const normalizedPhone = item.phone ? normalizePhone(item.phone) : null;
      const cleanEmail = item.email ? item.email.trim().toLowerCase() : null;
      let cleanUsername = item.username ? item.username.trim().toLowerCase() : null;
      if (cleanUsername && !isValidUsername(cleanUsername)) {
        cleanUsername = null;
      }

      const finalEmail =
        cleanEmail ||
        `phone_${(normalizedPhone || "user").replace(/[^\d]/g, "")}_${Date.now()}_${Math.floor(Math.random() * 1000)}@noemail.local`;

      const rawPassword = generateSecurePassword(16);
      const passwordHash = await hashPassword(rawPassword);

      let user = await db.platformUser.findFirst({
        where: {
          OR: [
            ...(cleanEmail ? [{ email: cleanEmail }] : []),
            ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
            ...(cleanUsername ? [{ username: cleanUsername }] : []),
          ],
        },
      });

      let isExisting = false;
      if (!user) {
        user = await db.platformUser.create({
          data: {
            fullName: item.fullName.trim(),
            email: finalEmail,
            phone: normalizedPhone,
            username: cleanUsername,
            passwordHash,
            preferredLanguage: (item.preferredLanguage === "uz-Latn" ? "uz_Latn" : "ru") as unknown as Language,
            mustChangePassword: true,
            emailVerified: cleanEmail ? null : new Date(),
          },
        });
      } else {
        isExisting = true;
      }

      const existingMem = await tenantDb.centerMembership.findFirst({
        where: { userId: user.id, centerId: center.id, role: item.role },
      });

      if (existingMem) {
        results.push({
          login: cleanEmail || normalizedPhone || user.email,
          password: "",
          fullName: item.fullName,
          role: item.role,
          status: "SKIPPED",
          error: "Пользователь уже состоит в центре с этой ролью",
        });
        continue;
      }

      const membership = await tenantDb.centerMembership.create({
        data: {
          centerId: center.id,
          userId: user.id,
          role: item.role,
          status: "ACTIVE",
        },
      });

      if (item.role === "STUDENT" && item.groupId) {
        await tenantDb.enrollment.create({
          data: {
            centerId: center.id,
            studentMembershipId: membership.id,
            groupId: item.groupId,
            status: "ACTIVE",
          },
        }).catch(() => null);
      }

      const primaryLogin = cleanEmail || normalizedPhone || cleanUsername || user.email;

      results.push({
        login: primaryLogin,
        password: isExisting ? "(действующий пароль аккаунта)" : rawPassword,
        fullName: user.fullName,
        role: item.role,
        status: isExisting ? "EXISTING_LINKED" : "CREATED",
      });
    }

    await logAuditEvent({
      centerId: center.id,
      actorUserId: actorUser.id,
      action: "BULK_CREATE_USERS",
      resource: "CenterMembership",
      resourceId: center.id,
      details: {
        actorRole,
        totalRequested: parsed.users.length,
        createdCount: results.filter((r) => r.status === "CREATED").length,
        linkedCount: results.filter((r) => r.status === "EXISTING_LINKED").length,
        skippedCount: results.filter((r) => r.status === "SKIPPED").length,
      },
    });

    return NextResponse.json(
      {
        success: true,
        loginUrl,
        items: results,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    console.error("POST /api/tenant/users/bulk error:", err);
    return NextResponse.json({ error: "Failed to process bulk import" }, { status: 500 });
  }
}
