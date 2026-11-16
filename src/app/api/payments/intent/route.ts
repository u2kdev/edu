import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientRateLimitKey } from "@/lib/rate-limit";
import { BillingError } from "@/lib/billing";
import { createClickPaymentIntent } from "@/lib/click";
import {
  requirePlanFeature,
  PlanFeatureLockedError,
  formatPlanFeatureLockedPayload,
} from "@/lib/plan-features";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const createIntentSchema = z
  .object({
    studentMembershipId: z.string().uuid().optional().nullable(),
    groupId: z.string().uuid().optional().nullable(),
    chargeId: z.string().uuid().optional().nullable(),
    periodMonths: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().nullable(),
    promoCode: z.string().trim().max(64).optional().nullable(),
    returnUrl: z
      .string()
      .trim()
      .max(500)
      .refine(
        (v) => v.startsWith("/") || v.startsWith("https://") || v.startsWith("http://localhost"),
        "Некорректный returnUrl"
      )
      .optional()
      .nullable(),
    idempotencyKey: z.string().trim().max(120).optional().nullable(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (tenantCtx.isImpersonating) {
      return NextResponse.json(
        { error: "Forbidden: Impersonation sessions are read-only" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    await requirePlanFeature(tenantCtx.center.id, "onlinePaymentsClick");

    const rlKey = getClientRateLimitKey(req, `click_intent_${tenantCtx.session.user.id}`);
    const allowed = await checkRateLimit(rlKey, 30, 60 * 1000, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Слишком много запросов на создание оплаты. Попробуйте позже." },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Некорректный JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = createIntentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные параметры онлайн-оплаты", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const body = parsed.data;
    const tenantDb = tenantCtx.getTenantDb();
    let targetStudentMembershipId: string;

    if (tenantCtx.role === "STUDENT") {
      if (!tenantCtx.membership) {
        return NextResponse.json(
          { error: "Active student membership required" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
      if (body.studentMembershipId && body.studentMembershipId !== tenantCtx.membership.id) {
        return NextResponse.json(
          { error: "Forbidden: Ученик может создавать оплату только за себя" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
      targetStudentMembershipId = tenantCtx.membership.id;
    } else if (tenantCtx.role === "PARENT") {
      if (!tenantCtx.membership) {
        return NextResponse.json(
          { error: "Active parent membership required" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
      const links = await tenantDb.parentLink.findMany({
        where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
        select: { studentMembershipId: true },
      });
      const childIds = links.map((l) => l.studentMembershipId);
      if (childIds.length === 0) {
        return NextResponse.json(
          { error: "Forbidden: Нет подтверждённых связей с учениками" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
      const requested = body.studentMembershipId || (childIds.length === 1 ? childIds[0] : null);
      if (!requested || !childIds.includes(requested)) {
        return NextResponse.json(
          { error: "Forbidden: Можно оплачивать только за своих подтверждённых детей" },
          { status: 403, headers: NO_STORE_HEADERS }
        );
      }
      targetStudentMembershipId = requested;
    } else if (
      tenantCtx.isPlatformStaff ||
      hasPermission("payments.manage", tenantCtx.session.user.platformRole, tenantCtx.role)
    ) {
      if (!body.studentMembershipId) {
        return NextResponse.json(
          { error: "Укажите studentMembershipId" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      targetStudentMembershipId = body.studentMembershipId;
    } else {
      return NextResponse.json(
        { error: "Forbidden: Нет прав на инициацию оплаты" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const origin = new URL(req.url).origin;
    const resolvedReturnUrl = body.returnUrl
      ? body.returnUrl.startsWith("/")
        ? `${origin}${body.returnUrl}`
        : body.returnUrl
      : `${origin}/center/payments`;

    const result = await createClickPaymentIntent({
      centerId: tenantCtx.center.id,
      studentMembershipId: targetStudentMembershipId,
      groupId: body.groupId ?? null,
      chargeId: body.chargeId ?? null,
      periodMonths: body.periodMonths ?? null,
      promoCode: body.promoCode ?? null,
      returnUrl: resolvedReturnUrl,
      actorUserId: tenantCtx.session.user.id,
      idempotencyKey: body.idempotencyKey ?? null,
    });

    return NextResponse.json(
      {
        success: true,
        intent: result.intent,
        clickUrl: result.clickUrl,
        qrDataUrl: result.qrDataUrl,
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
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
      { error: error?.status ? error.message : "Ошибка создания онлайн-оплаты Click" },
      { status: error?.status || 500, headers: NO_STORE_HEADERS }
    );
  }
}
