import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError, logAuditEvent } from "@/lib/tenant";
import { isActorImpersonating } from "@/lib/tenant-access";
import { normalizePhone } from "@/lib/phone";
// Reason: Exception: Account self-service operates on platformUser model scoped by session.user.id.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { z } from "zod";
import { Language } from "@prisma/client";

const updateProfileSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  avatarUrl: z.string().max(500).optional().nullable(),
  preferredLanguage: z.enum(["ru", "uz-Latn", "uz_Latn", "uz-Cyrl", "uz_Cyrl"]).optional(),
  phone: z.string().max(30).optional().nullable(),
  phoneConfirmationCode: z.string().max(10).optional(),
});

function mapLanguageEnum(raw?: string): Language | undefined {
  if (!raw) return undefined;
  if (raw === "ru") return Language.ru;
  if (raw === "uz-Latn" || raw === "uz_Latn") return Language.uz_Latn;
  if (raw === "uz-Cyrl" || raw === "uz_Cyrl") return Language.uz_Cyrl;
  return undefined;
}

function formatLanguageCode(lang: Language): string {
  if (lang === Language.uz_Latn) return "uz-Latn";
  if (lang === Language.uz_Cyrl) return "uz-Cyrl";
  return "ru";
}

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { role, session } = tenantCtx;

    const user = await db.platformUser.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        username: true,
        avatarUrl: true,
        preferredLanguage: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const canEditFullName =
      role === "DIRECTOR" ||
      role === "CENTER_ADMIN" ||
      tenantCtx.isPlatformStaff;

    return NextResponse.json({
      profile: {
        ...user,
        preferredLanguage: formatLanguageCode(user.preferredLanguage),
        role,
        canEditFullName,
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/account/profile]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session } = tenantCtx;

    if (isActorImpersonating(tenantCtx)) {
      return NextResponse.json(
        { error: "Read-only impersonation mode" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const currentUser = await db.platformUser.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        fullName: true,
        phone: true,
        avatarUrl: true,
        preferredLanguage: true,
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const canEditFullName =
      role === "DIRECTOR" ||
      role === "CENTER_ADMIN" ||
      tenantCtx.isPlatformStaff;

    if (
      parsed.data.fullName !== undefined &&
      parsed.data.fullName.trim() !== currentUser.fullName.trim() &&
      !canEditFullName
    ) {
      return NextResponse.json(
        {
          error:
            "Forbidden: ФИО может изменить только администрация учебного центра",
        },
        { status: 403 }
      );
    }

    let normalizedPhone: string | null | undefined = undefined;
    if (parsed.data.phone !== undefined) {
      if (parsed.data.phone === null || parsed.data.phone.trim() === "") {
        normalizedPhone = null;
      } else {
        const norm = normalizePhone(parsed.data.phone);
        if (!norm) {
          return NextResponse.json(
            {
              error:
                "Некорректный формат телефона. Используйте формат +998XXXXXXXXX",
            },
            { status: 400 }
          );
        }
        const duplicatePhone = await db.platformUser.findFirst({
          where: {
            phone: norm,
            id: { not: session.user.id },
            deletedAt: null,
          },
          select: { id: true },
        });
        if (duplicatePhone) {
          return NextResponse.json(
            { error: "Этот номер телефона уже привязан к другому аккаунту" },
            { status: 409 }
          );
        }
        normalizedPhone = norm;
      }
    }

    const nextLang = mapLanguageEnum(parsed.data.preferredLanguage);

    const updated = await db.platformUser.update({
      where: { id: session.user.id },
      data: {
        ...(canEditFullName && parsed.data.fullName
          ? { fullName: parsed.data.fullName.trim() }
          : {}),
        ...(parsed.data.avatarUrl !== undefined
          ? { avatarUrl: parsed.data.avatarUrl }
          : {}),
        ...(nextLang ? { preferredLanguage: nextLang } : {}),
        ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        username: true,
        avatarUrl: true,
        preferredLanguage: true,
        twoFactorEnabled: true,
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "USER_PROFILE_UPDATED",
      resource: "PlatformUser",
      resourceId: session.user.id,
      details: {
        changedAvatar: parsed.data.avatarUrl !== undefined,
        changedLanguage: parsed.data.preferredLanguage,
        changedPhone: normalizedPhone !== undefined,
        changedFullName:
          canEditFullName && parsed.data.fullName !== undefined,
      },
    });

    return NextResponse.json({
      success: true,
      profile: {
        ...updated,
        preferredLanguage: formatLanguageCode(updated.preferredLanguage),
        role,
        canEditFullName,
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[PATCH /api/account/profile]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
