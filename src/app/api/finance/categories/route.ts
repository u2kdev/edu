import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["INCOME", "EXPENSE"]),
  code: z.string().trim().max(64).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
});

const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  code: z.string().trim().max(64).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

function canReadFinance(role: string, isPlatformStaff: boolean): boolean {
  if (isPlatformStaff) return true;
  return hasPermission("finance.read", "NONE", role);
}

function canWriteFinance(role: string, isPlatformStaff: boolean): boolean {
  if (isPlatformStaff) return true;
  return hasPermission("finance.write", "NONE", role);
}

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!canReadFinance(tenantCtx.role, tenantCtx.isPlatformStaff)) {
      return NextResponse.json(
        { error: "Forbidden: No permission to read finance categories" },
        { status: 403 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const { searchParams } = new URL(req.url);
    const typeFilter = searchParams.get("type");
    const includeInactive = searchParams.get("includeInactive") === "true";

    const where: Record<string, unknown> = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    if (typeFilter === "INCOME" || typeFilter === "EXPENSE") {
      where.type = typeFilter;
    }

    const categories = await tenantDb.financeCategory.findMany({
      where,
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ categories });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to load finance categories", code: error.code },
      { status: error.status || 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!canWriteFinance(tenantCtx.role, tenantCtx.isPlatformStaff)) {
      return NextResponse.json(
        { error: "Forbidden: No permission to create finance categories" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`finance_categories:${tenantCtx.session.user.id}:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const rawBody = await req.json();
    const parsed = createCategorySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid category payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const { name, type, code, description } = parsed.data;

    const category = await tenantDb.financeCategory.create({
      data: {
        centerId: tenantCtx.center.id,
        name,
        type,
        code: code ?? null,
        description: description ?? null,
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "FINANCE_CATEGORY_CREATED",
      resource: "FinanceCategory",
      resourceId: category.id,
      details: { name: category.name, type: category.type, code: category.code },
      ipAddress: ip,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to create finance category", code: error.code },
      { status: error.status || 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!canWriteFinance(tenantCtx.role, tenantCtx.isPlatformStaff)) {
      return NextResponse.json(
        { error: "Forbidden: No permission to update finance categories" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`finance_categories_patch:${tenantCtx.session.user.id}:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const rawBody = await req.json();
    const parsed = updateCategorySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid category update payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const { id, ...updateFields } = parsed.data;

    const category = await tenantDb.financeCategory.update({
      where: { id },
      data: updateFields,
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "FINANCE_CATEGORY_UPDATED",
      resource: "FinanceCategory",
      resourceId: id,
      details: updateFields,
      ipAddress: ip,
    });

    return NextResponse.json({ category });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to update finance category", code: error.code },
      { status: error.status || 400 }
    );
  }
}
