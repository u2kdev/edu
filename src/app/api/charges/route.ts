import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { BillingError, createChargeForEnrollment } from "@/lib/billing";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const createChargeSchema = z
  .object({
    enrollmentId: z.string().uuid(),
    periodMonths: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    periodStart: z.string().datetime().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    promoCode: z.string().trim().max(64).optional().nullable(),
    manualDiscountAmount: z.coerce.number().int().min(0).optional().default(0),
    discountReason: z.string().trim().max(300).optional().nullable(),
  })
  .strict();

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status")?.trim();
    const groupIdParam = searchParams.get("groupId")?.trim();
    const studentMembershipIdParam = searchParams.get("studentMembershipId")?.trim();
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      where.studentMembershipId = tenantCtx.membership.id;
    } else if (tenantCtx.role === "PARENT" && tenantCtx.membership) {
      const links = await tenantDb.parentLink.findMany({
        where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
        select: { studentMembershipId: true },
      });
      where.studentMembershipId = { in: links.map((l) => l.studentMembershipId) };
    } else if (
      !tenantCtx.isPlatformStaff &&
      !hasPermission("payments.read", tenantCtx.session.user.platformRole, tenantCtx.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    } else if (studentMembershipIdParam) {
      where.studentMembershipId = studentMembershipIdParam;
    }

    if (statusParam && ["PENDING", "PARTIAL", "PAID", "CANCELLED", "REFUNDED"].includes(statusParam)) {
      where.status = statusParam;
    }
    if (groupIdParam) {
      where.groupId = groupIdParam;
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { student: { user: { fullName: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const [charges, total] = await Promise.all([
      tenantDb.charge.findMany({
        where,
        include: {
          student: {
            include: { user: { select: { fullName: true, phone: true, email: true } } },
          },
          group: { select: { id: true, name: true, course: { select: { title: true } } } },
          promoCode: { select: { id: true, code: true } },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      tenantDb.charge.count({ where }),
    ]);

    return NextResponse.json(
      {
        charges,
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
      { error: error?.status ? error.message : "Ошибка загрузки начислений" },
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
    if (!tenantCtx.session.user.emailVerified) {
      return NextResponse.json(
        { error: "Email confirmation required for sensitive actions" },
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

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Некорректный JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = createChargeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные данные начисления", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const body = parsed.data;
    const charge = await createChargeForEnrollment({
      centerId: tenantCtx.center.id,
      enrollmentId: body.enrollmentId,
      periodMonths: body.periodMonths,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      promoCode: body.promoCode ?? null,
      manualDiscountAmount: body.manualDiscountAmount,
      discountReason: body.discountReason ?? null,
      actorUserId: tenantCtx.session.user.id,
      actor: {
        centerRole: tenantCtx.role ?? "NONE",
        platformRole: tenantCtx.session.user.platformRole,
        membershipPermissions: tenantCtx.membership?.permissions ?? null,
      },
    });

    return NextResponse.json({ success: true, charge }, { status: 201, headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка создания начисления" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
