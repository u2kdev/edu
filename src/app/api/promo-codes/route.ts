import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { BillingError, validatePromoCodeEligibility } from "@/lib/billing";
import {
  requirePlanFeature,
  PlanFeatureLockedError,
  formatPlanFeatureLockedPayload,
} from "@/lib/plan-features";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const createPromoSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, "Код может содержать только латинские буквы, цифры, - и _"),
    discountType: z.enum(["PERCENT", "FIXED"]),
    value: z.coerce.number().int().positive(),
    validFrom: z.string().datetime().optional().nullable(),
    validUntil: z.string().datetime().optional().nullable(),
    maxUses: z.coerce.number().int().positive().optional().nullable(),
    applicableCourseId: z.string().uuid().optional().nullable(),
    applicableGroupId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const { searchParams } = new URL(req.url);

    // Optional live promo preview check for checkout/payment modal
    const validateCode = searchParams.get("validateCode")?.trim();
    if (validateCode) {
      const subtotal = Math.max(0, parseInt(searchParams.get("subtotal") || "0", 10) || 0);
      const groupId = searchParams.get("groupId")?.trim() || null;
      const courseId = searchParams.get("courseId")?.trim() || null;

      try {
        const result = await validatePromoCodeEligibility({
          centerId: tenantCtx.center.id,
          code: validateCode,
          subtotal,
          groupId,
          courseId,
        });
        return NextResponse.json(
          {
            valid: true,
            promo: {
              id: result.promo.id,
              code: result.promo.code,
              discountType: result.promo.discountType,
              value: result.promo.value,
            },
            discountAmount: result.discountAmount,
            finalAmount: Math.max(0, subtotal - result.discountAmount),
          },
          { headers: NO_STORE_HEADERS }
        );
      } catch (err) {
        if (err instanceof BillingError) {
          return NextResponse.json(
            { valid: false, error: err.message, code: err.code },
            { status: err.status, headers: NO_STORE_HEADERS }
          );
        }
        throw err;
      }
    }

    if (
      !tenantCtx.isPlatformStaff &&
      !hasPermission("payments.manage", tenantCtx.session.user.platformRole, tenantCtx.role) &&
      !hasPermission("finance.read", tenantCtx.session.user.platformRole, tenantCtx.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const search = (searchParams.get("search") || "").trim();
    const statusFilter = searchParams.get("status")?.trim(); // ACTIVE | INACTIVE | EXPIRED
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Record<string, unknown> = {};
    if (search) {
      where.code = { contains: search.toUpperCase(), mode: "insensitive" };
    }
    if (statusFilter === "ACTIVE") {
      where.isActive = true;
      where.OR = [{ validUntil: null }, { validUntil: { gte: now } }];
    } else if (statusFilter === "INACTIVE") {
      where.isActive = false;
    } else if (statusFilter === "EXPIRED") {
      where.validUntil = { lt: now };
    }

    const [promoCodes, total] = await Promise.all([
      tenantDb.promoCode.findMany({
        where,
        include: {
          applicableCourse: { select: { id: true, title: true } },
          applicableGroup: { select: { id: true, name: true } },
          _count: { select: { redemptions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      tenantDb.promoCode.count({ where }),
    ]);

    return NextResponse.json(
      {
        promoCodes,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка загрузки промокодов" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (tenantCtx.isImpersonating) {
      return NextResponse.json(
        { error: "Forbidden: Impersonation sessions are read-only" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }
    if (
      !tenantCtx.isPlatformStaff &&
      !hasPermission("payments.manage", tenantCtx.session.user.platformRole, tenantCtx.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    await requirePlanFeature(tenantCtx.center.id, "promoCodes");

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Некорректный JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = createPromoSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные данные промокода", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const body = parsed.data;
    if (body.discountType === "PERCENT" && (body.value < 1 || body.value > 100)) {
      return NextResponse.json(
        { error: "Процентная скидка должна быть от 1 до 100" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    if (body.applicableCourseId) {
      const course = await tenantDb.course.findFirst({
        where: { id: body.applicableCourseId },
        select: { id: true },
      });
      if (!course) {
        return NextResponse.json(
          { error: "Указанный курс не найден в этом центре" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }
    }
    if (body.applicableGroupId) {
      const group = await tenantDb.group.findFirst({
        where: { id: body.applicableGroupId },
        select: { id: true },
      });
      if (!group) {
        return NextResponse.json(
          { error: "Указанная группа не найдена в этом центре" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }
    }

    const validFrom = body.validFrom ? new Date(body.validFrom) : new Date();
    const validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (validUntil && validUntil <= validFrom) {
      return NextResponse.json(
        { error: "Дата окончания должна быть позже даты начала" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const normalizedCode = body.code.trim().toUpperCase();
    const created = await tenantDb.promoCode.create({
      data: {
        centerId: tenantCtx.center.id,
        code: normalizedCode,
        discountType: body.discountType,
        value: body.value,
        validFrom,
        validUntil,
        maxUses: body.maxUses ?? null,
        applicableCourseId: body.applicableCourseId ?? null,
        applicableGroupId: body.applicableGroupId ?? null,
        isActive: body.isActive,
        createdByUserId: tenantCtx.session.user.id,
      },
      include: {
        applicableCourse: { select: { id: true, title: true } },
        applicableGroup: { select: { id: true, name: true } },
        _count: { select: { redemptions: true } },
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "PROMO_CODE_CREATED",
      resource: "PromoCode",
      resourceId: created.id,
      details: {
        code: created.code,
        discountType: created.discountType,
        value: created.value,
        maxUses: created.maxUses,
      },
    });

    return NextResponse.json({ success: true, promoCode: created }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof PlanFeatureLockedError) {
      return NextResponse.json(formatPlanFeatureLockedPayload(err), {
        status: 403,
        headers: NO_STORE_HEADERS,
      });
    }
    const errStr = String(err);
    if (errStr.includes("Unique constraint") || errStr.includes("P2002")) {
      return NextResponse.json(
        { error: "Промокод с таким кодом уже существует в центре" },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка создания промокода" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
