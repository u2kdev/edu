import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Account self-service operates on platform user model.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, comparePassword, hashPassword } from "@/lib/auth";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Текущий пароль обязателен"),
    newPassword: z
      .string()
      .min(8, "Пароль должен содержать минимум 8 символов")
      .regex(/[a-z]/, "Пароль должен содержать строчные буквы")
      .regex(/[A-Z]/, "Пароль должен содержать заглавные буквы")
      .regex(/[0-9]/, "Пароль должен содержать цифры"),
    confirmPassword: z.string().min(1, "Подтверждение пароля обязательно"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Новые пароли не совпадают",
    path: ["confirmPassword"],
  });

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.platformRole === "PLATFORM_SUPPORT") {
      return NextResponse.json({ error: "Forbidden: Platform support has read-only access" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Неверные данные" },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await db.platformUser.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Неверный текущий пароль" },
        { status: 400 }
      );
    }

    const isSameAsOld = await comparePassword(newPassword, user.passwordHash);
    if (isSameAsOld) {
      return NextResponse.json(
        { error: "Новый пароль не может совпадать с текущим" },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);

    await db.platformUser.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    await logAuditEvent({
      action: "PLATFORM_USER_PASSWORD_CHANGED",
      resource: "PlatformUser",
      resourceId: user.id,
      actorUserId: user.id,
      ipAddress: getClientIp(req),
      details: {
        forcedChange: user.mustChangePassword,
      },
    });

    const isPlatformStaff = [
      "SUPERADMIN",
      "DEVELOPER",
      "PLATFORM_ADMIN",
      "PLATFORM_SUPPORT",
      "SEO_ADMIN",
    ].includes(session.user.platformRole);

    let redirectUrl = "/";
    if (isPlatformStaff && (!session.activeCenterId || session.memberships.length === 0)) {
      redirectUrl = "/platform-admin";
    } else if (session.activeCenterId || session.memberships.length > 0) {
      redirectUrl = "/center";
    } else if (isPlatformStaff) {
      redirectUrl = "/platform-admin";
    }

    return NextResponse.json({
      success: true,
      redirectUrl,
      message: "Пароль успешно обновлён",
    });
  } catch (error) {
    console.error("[change-password]", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка при смене пароля" },
      { status: 500 }
    );
  }
}
