import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: First platform owner initialization is a global platform model operation.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { checkRateLimit, getClientRateLimitKey } from "@/lib/rate-limit";
import { verifySetupToken } from "@/lib/setup-token";

const setupSchema = z.object({
  email: z.string().email("Некорректный email").toLowerCase().trim(),
  password: z.string().min(8, "Пароль должен содержать минимум 8 символов"),
  fullName: z.string().min(2, "Укажите имя и фамилию"),
});

export async function GET(req: Request) {
  const probeKey = getClientRateLimitKey(req, "first-owner-get");
  const allowed = await checkRateLimit(probeKey, 10, 60000);
  if (!allowed) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });
  }

  // 1. Without valid SETUP_TOKEN -> 404 Not Found
  if (!verifySetupToken(req)) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  // 2. If SUPERADMIN already exists -> 404 Not Found
  const superadminCount = await db.platformUser.count({
    where: { platformRole: "SUPERADMIN" },
  });

  if (superadminCount > 0) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  return NextResponse.json({ canInitialize: true });
}

export async function POST(req: Request) {
  try {
    // 1. Rate limiting (anti-bruteforce)
    const rateLimitKey = getClientRateLimitKey(req, "first-owner");
    const allowed = await checkRateLimit(rateLimitKey, 5, 60000);
    if (!allowed) {
      return NextResponse.json({ error: "Слишком много попыток. Попробуйте позже." }, { status: 429 });
    }

    // 2. Token verification - fail-closed 404 if invalid, missing, or unset
    if (!verifySetupToken(req)) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // 3. Pre-transaction check to avoid expensive hashing if already initialized
    const existingCount = await db.platformUser.count({
      where: { platformRole: "SUPERADMIN" },
    });
    if (existingCount > 0) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // 4. Validate input payload
    const body = await req.json();
    const parsed = setupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { email, password, fullName } = parsed.data;

    // 5. Transactional double-checked creation with advisory transaction lock
    const result = await db.$transaction(async (tx) => {
      // Serialize concurrent setup attempts via PostgreSQL advisory transaction lock
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(42424242)");

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
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
