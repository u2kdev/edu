import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: First platform owner initialization is a global platform model operation.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";

const setupSchema = z.object({
  email: z.string().email("Некорректный email").toLowerCase().trim(),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
  fullName: z.string().min(2, "Укажите имя и фамилию"),
});

export async function GET() {
  const superadminCount = await db.platformUser.count({
    where: { platformRole: "SUPERADMIN" },
  });

  return NextResponse.json({
    canInitialize: superadminCount === 0,
  });
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`first-owner:${ip}`, 5, 60000);
    if (!allowed) {
      return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { email, password, fullName } = parsed.data;

    const result = await db.$transaction(async (tx) => {
      const count = await tx.platformUser.count({
        where: { platformRole: "SUPERADMIN" },
      });

      if (count > 0) {
        throw new Error("ALREADY_INITIALIZED");
      }

      const passwordHash = await hashPassword(password);
      const existingUser = await tx.platformUser.findUnique({
        where: { email },
      });

      let user;
      if (existingUser) {
        user = await tx.platformUser.update({
          where: { id: existingUser.id },
          data: {
            fullName,
            passwordHash,
            platformRole: "SUPERADMIN",
            emailVerified: new Date(),
            isActive: true,
          },
        });
      } else {
        user = await tx.platformUser.create({
          data: {
            email,
            fullName,
            passwordHash,
            platformRole: "SUPERADMIN",
            emailVerified: new Date(),
            isActive: true,
          },
        });
      }

      // Audit log - strictly never log plaintext password
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "PLATFORM_FIRST_OWNER_CREATED",
          resource: "PlatformUser",
          resourceId: user.id,
          detailsJson: JSON.stringify({
            email: user.email,
            fullName: user.fullName,
            platformRole: user.platformRole,
          }),
        },
      });

      return user;
    });

    return NextResponse.json(
      {
        success: true,
        user: {
          id: result.id,
          email: result.email,
          fullName: result.fullName,
          platformRole: result.platformRole,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ALREADY_INITIALIZED") {
      return NextResponse.json(
        { error: "Платформа уже инициализирована. Создание владельца заблокировано." },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
