import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError, logAuditEvent } from "@/lib/tenant";
import { isActorImpersonating } from "@/lib/tenant-access";
import { getAuthSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
// Reason: Exception: Account self-service operates on platformUser model scoped by session.user.id.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { z } from "zod";
import { Language } from "@prisma/client";

const updateProfileSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    avatarUrl: z.string().max(500).optional().nullable(),
    preferredLanguage: z.enum(["ru", "uz-Latn", "uz_Latn", "uz-Cyrl", "uz_Cyrl"]).optional(),
    phone: z.string().max(30).optional().nullable(),
    phoneConfirmationCode: z.string().max(10).optional(),
  })
  .strict();

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

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function resolveProfileActor(req: Request, isWrite: boolean) {
  const rawSession = await getAuthSession(req);
  if (!rawSession) {
    throw new TenantAccessError("Unauthorized: No session found", "UNAUTHORIZED", 401);
  }

  if (rawSession.activeCenterId) {
    const tenantCtx = await requireTenantAccess(req, { isWrite });
    const canEditFullName =
      tenantCtx.role === "DIRECTOR" ||
      tenantCtx.role === "CENTER_ADMIN" ||
      tenantCtx.isPlatformStaff;
    return {
      session: tenantCtx.session,
      role: tenantCtx.role,
      centerId: tenantCtx.center.id,
      canEditFullName,
      isReadOnly: isActorImpersonating(tenantCtx) || Boolean(tenantCtx.session.isReadOnly),
    };
  }

  const platformRole = rawSession.user.platformRole || "NONE";
  const isPlatformStaff =
    platformRole !== "NONE" &&
    ["DEVELOPER", "SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT", "SEO_ADMIN"].includes(
      platformRole
    );
  const readOnly =
    Boolean(rawSession.isReadOnly) ||
    Boolean(rawSession.impersonatorUserId) ||
    platformRole === "PLATFORM_SUPPORT";

  if (isWrite && readOnly) {
    throw new TenantAccessError("Read-only impersonation mode", "FORBIDDEN", 403);
  }

  return {
    session: rawSession,
    role: platformRole !== "NONE" ? platformRole : "USER",
    centerId: undefined as string | undefined,
    canEditFullName: isPlatformStaff && platformRole !== "PLATFORM_SUPPORT",
    isReadOnly: readOnly,
  };
}

export async function GET(req: Request) {
  try {
    const actor = await resolveProfileActor(req, false);

    const user = await db.platformUser.findUnique({
      where: { id: actor.session.user.id },
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
      return noStoreJson({ error: "User not found" }, 404);
    }

    return noStoreJson({
      profile: {
        ...user,
        preferredLanguage: formatLanguageCode(user.preferredLanguage),
        role: actor.role,
        canEditFullName: actor.canEditFullName,
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return noStoreJson({ error: error.message }, error.status);
    }
    console.error("[GET /api/account/profile]", error);
    return noStoreJson({ error: "Internal Server Error" }, 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await resolveProfileActor(req, true);
    const { session, role, canEditFullName, centerId, isReadOnly } = actor;

    if (isReadOnly) {
      return noStoreJson({ error: "Read-only impersonation mode" }, 403);
    }

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson(
        { error: "Validation error", details: parsed.error.flatten() },
        400
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
      return noStoreJson({ error: "User not found" }, 404);
    }

    if (
      parsed.data.fullName !== undefined &&
      parsed.data.fullName.trim() !== currentUser.fullName.trim() &&
      !canEditFullName
    ) {
      return noStoreJson(
        {
          error:
            "Forbidden: ФИО может изменить только администрация учебного центра",
        },
        403
      );
    }

    let normalizedPhone: string | null | undefined = undefined;
    if (parsed.data.phone !== undefined) {
      if (parsed.data.phone === null || parsed.data.phone.trim() === "") {
        normalizedPhone = null;
      } else {
        const norm = normalizePhone(parsed.data.phone);
        if (!norm) {
          return noStoreJson(
            {
              error:
                "Некорректный формат телефона. Используйте формат +998XXXXXXXXX",
            },
            400
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
          return noStoreJson(
            { error: "Этот номер телефона уже привязан к другому аккаунту" },
            409
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
      ...(centerId ? { centerId } : {}),
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

    return noStoreJson({
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
      return noStoreJson({ error: error.message }, error.status);
    }
    console.error("[PATCH /api/account/profile]", error);
    return noStoreJson({ error: "Internal Server Error" }, 500);
  }
}
