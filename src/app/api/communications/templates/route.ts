import { NextResponse } from "next/server";
import { z } from "zod";
import type { Language } from "@prisma/client";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientRateLimitKey } from "@/lib/rate-limit";
import {
  getCenterPlanFeatures,
  requirePlanFeature,
  PlanFeatureLockedError,
  formatPlanFeatureLockedPayload,
} from "@/lib/plan-features";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const templateUpsertSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9_-]+$/i, "Ключ шаблона может содержать только латиницу, цифры, _ и -"),
    locale: z.enum(["ru", "uz-Latn", "uz_Latn", "uz"]),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(4000),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

function normalizePrismaLanguage(locale: string): Language {
  if (locale === "uz-Latn" || locale === "uz_Latn" || locale === "uz") {
    return "uz_Latn";
  }
  return "ru";
}

function canReadTemplates(tenantCtx: Awaited<ReturnType<typeof requireTenantAccess>>): boolean {
  if (tenantCtx.isPlatformStaff || tenantCtx.isImpersonating) return true;
  return (
    hasPermission("announcements.manage", tenantCtx.session.user.platformRole, tenantCtx.role) ||
    hasPermission("announcements.create", tenantCtx.session.user.platformRole, tenantCtx.role) ||
    hasPermission("settings.read", tenantCtx.session.user.platformRole, tenantCtx.role)
  );
}

function canManageTemplates(tenantCtx: Awaited<ReturnType<typeof requireTenantAccess>>): boolean {
  if (
    tenantCtx.isImpersonating ||
    tenantCtx.session.impersonatorUserId ||
    tenantCtx.session.user.platformRole === "PLATFORM_SUPPORT"
  ) {
    return false;
  }
  return hasPermission("announcements.manage", "NONE", tenantCtx.role);
}

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!canReadTemplates(tenantCtx)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const { searchParams } = new URL(req.url);
    const localeParam = searchParams.get("locale")?.trim();
    const search = searchParams.get("search")?.trim();
    const onlyActive = searchParams.get("isActive");

    const where: Record<string, unknown> = {
      centerId: tenantCtx.center.id,
    };
    if (localeParam) {
      where.locale = normalizePrismaLanguage(localeParam);
    }
    if (onlyActive === "true") where.isActive = true;
    if (onlyActive === "false") where.isActive = false;
    if (search) {
      where.OR = [
        { key: { contains: search, mode: "insensitive" } },
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
      ];
    }

    const tenantDb = tenantCtx.getTenantDb();
    const [templates, planCtx] = await Promise.all([
      tenantDb.communicationTemplate.findMany({
        where,
        orderBy: [{ key: "asc" }, { locale: "asc" }],
      }),
      getCenterPlanFeatures(tenantCtx.center.id),
    ]);

    return NextResponse.json(
      {
        templates,
        planFeatures: planCtx.features,
        planName: planCtx.planName,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка загрузки шаблонов" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

async function handleUpsert(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!canManageTemplates(tenantCtx)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
    }

    await requirePlanFeature(tenantCtx.center.id, "broadcasts");

    const rlKey = getClientRateLimitKey(req, `comm_tpl_${tenantCtx.session.user.id}`);
    const allowed = await checkRateLimit(rlKey, 60, 60_000, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Слишком много запросов. Попробуйте позже." },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const parsed = templateUpsertSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные данные шаблона", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const normalizedKey = parsed.data.key.trim().toLowerCase();
    const locale = normalizePrismaLanguage(parsed.data.locale);
    const tenantDb = tenantCtx.getTenantDb();

    const existing = await tenantDb.communicationTemplate.findFirst({
      where: {
        centerId: tenantCtx.center.id,
        key: normalizedKey,
        locale,
      },
    });

    let template;
    if (existing) {
      await tenantDb.communicationTemplate.updateMany({
        where: { id: existing.id },
        data: {
          title: parsed.data.title,
          body: parsed.data.body,
          isActive: parsed.data.isActive,
        },
      });
      template = await tenantDb.communicationTemplate.findFirst({
        where: { id: existing.id },
      });
    } else {
      template = await tenantDb.communicationTemplate.create({
        data: {
          centerId: tenantCtx.center.id,
          key: normalizedKey,
          locale,
          title: parsed.data.title,
          body: parsed.data.body,
          isActive: parsed.data.isActive,
        },
      });
    }

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: existing ? "COMMUNICATION_TEMPLATE_UPDATED" : "COMMUNICATION_TEMPLATE_CREATED",
      resource: "CommunicationTemplate",
      resourceId: template?.id ?? existing?.id ?? undefined,
      details: { key: normalizedKey, locale, isActive: parsed.data.isActive },
    });

    return NextResponse.json(
      { success: true, template },
      { status: existing ? 200 : 201, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    if (err instanceof PlanFeatureLockedError) {
      return NextResponse.json(formatPlanFeatureLockedPayload(err), {
        status: 403,
        headers: NO_STORE_HEADERS,
      });
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка сохранения шаблона" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  return handleUpsert(req);
}

export async function PUT(req: Request) {
  return handleUpsert(req);
}

export async function DELETE(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!canManageTemplates(tenantCtx)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
    }

    await requirePlanFeature(tenantCtx.center.id, "broadcasts");

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id || !z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: "Некорректный ID шаблона" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const existing = await tenantDb.communicationTemplate.findFirst({
      where: { id, centerId: tenantCtx.center.id },
      select: { id: true, key: true, locale: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Шаблон не найден" }, { status: 404, headers: NO_STORE_HEADERS });
    }

    await tenantDb.communicationTemplate.deleteMany({
      where: { id: existing.id },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "COMMUNICATION_TEMPLATE_DELETED",
      resource: "CommunicationTemplate",
      resourceId: existing.id,
      details: { key: existing.key, locale: existing.locale },
    });

    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof PlanFeatureLockedError) {
      return NextResponse.json(formatPlanFeatureLockedPayload(err), {
        status: 403,
        headers: NO_STORE_HEADERS,
      });
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка удаления шаблона" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
