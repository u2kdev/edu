import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { BillingError } from "@/lib/billing";
import {
  requirePlanFeature,
  PlanFeatureLockedError,
  formatPlanFeatureLockedPayload,
} from "@/lib/plan-features";
import {
  getCenterMerchantConfigSummary,
  upsertCenterMerchantConfig,
  verifyCenterMerchantConnection,
  verifyDirectorReauth,
} from "@/lib/click";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const upsertMerchantSchema = z
  .object({
    serviceId: z.string().trim().min(1).max(64).regex(/^\d+$/, "Service ID должен состоять из цифр"),
    merchantId: z.string().trim().min(1).max(64).regex(/^\d+$/, "Merchant ID должен состоять из цифр"),
    merchantUserId: z.string().trim().max(64).optional().nullable(),
    secretKey: z.string().trim().min(6).max(256).optional().nullable(),
    targetAccountId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
    currentPassword: z.string().min(1, "Введите текущий пароль для подтверждения"),
    totpCode: z.string().trim().max(16).optional().nullable(),
  })
  .strict();

const testMerchantSchema = z
  .object({
    action: z.literal("test"),
  })
  .strict();

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const canRead =
      tenantCtx.isPlatformStaff ||
      hasPermission("settings.read", tenantCtx.session.user.platformRole, tenantCtx.role) ||
      hasPermission("finance.read", tenantCtx.session.user.platformRole, tenantCtx.role);

    if (!canRead) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const [config, accounts] = await Promise.all([
      getCenterMerchantConfigSummary(tenantCtx.center.id),
      tenantCtx.getTenantDb().account.findMany({
        where: { isActive: true },
        select: { id: true, name: true, type: true, isDefault: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      }),
    ]);

    return NextResponse.json({ config, accounts }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка загрузки настроек мерчанта" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);

    // Explicitly block impersonation and non-DIRECTOR roles from touching merchant credentials
    if (tenantCtx.isImpersonating || tenantCtx.session.impersonatorUserId) {
      return NextResponse.json(
        { error: "Forbidden: Изменение ключей мерчанта запрещено в режиме имперсонации" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    if (tenantCtx.role !== "DIRECTOR") {
      return NextResponse.json(
        { error: "Forbidden: Только директор центра может управлять ключами мерчанта" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    if (!tenantCtx.session.user.emailVerified) {
      return NextResponse.json(
        { error: "Email confirmation required for sensitive actions" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    await requirePlanFeature(tenantCtx.center.id, "onlinePaymentsClick");

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Некорректный JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = upsertMerchantSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные настройки мерчанта", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const reauth = await verifyDirectorReauth({
      userId: tenantCtx.session.user.id,
      currentPassword: parsed.data.currentPassword,
      totpCode: parsed.data.totpCode ?? null,
    });
    if (!reauth.ok) {
      return NextResponse.json(
        { error: reauth.error || "Ошибка подтверждения личности" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const config = await upsertCenterMerchantConfig({
      centerId: tenantCtx.center.id,
      serviceId: parsed.data.serviceId,
      merchantId: parsed.data.merchantId,
      merchantUserId: parsed.data.merchantUserId ?? null,
      secretKey: parsed.data.secretKey ?? null,
      targetAccountId: parsed.data.targetAccountId ?? null,
      isActive: parsed.data.isActive,
      actorUserId: tenantCtx.session.user.id,
    });

    return NextResponse.json({ success: true, config }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof PlanFeatureLockedError) {
      return NextResponse.json(formatPlanFeatureLockedPayload(err), {
        status: 403,
        headers: NO_STORE_HEADERS,
      });
    }
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка сохранения мерчанта" },
      { status: error?.status || 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);

    if (tenantCtx.isImpersonating || tenantCtx.session.impersonatorUserId) {
      return NextResponse.json(
        { error: "Forbidden: Проверка мерчанта запрещена в режиме имперсонации" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    if (tenantCtx.role !== "DIRECTOR") {
      return NextResponse.json(
        { error: "Forbidden: Только директор центра может проверять соединение мерчанта" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    await requirePlanFeature(tenantCtx.center.id, "onlinePaymentsClick");

    let rawBody: unknown = {};
    try {
      const text = await req.text();
      if (text.trim()) rawBody = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Некорректный JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = testMerchantSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверный запрос проверки мерчанта" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const config = await verifyCenterMerchantConnection({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
    });

    return NextResponse.json({ success: true, config }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof PlanFeatureLockedError) {
      return NextResponse.json(formatPlanFeatureLockedPayload(err), {
        status: 403,
        headers: NO_STORE_HEADERS,
      });
    }
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка проверки мерчанта" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
