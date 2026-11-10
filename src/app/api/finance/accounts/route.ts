import { NextResponse } from "next/server";
import { z } from "zod";
import { Currency } from "@prisma/client";
import { requireFinanceTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { calculateAccountBalance } from "@/lib/finance";

const createAccountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["CASH", "CARD", "BANK"]).default("CASH"),
  isDefault: z.boolean().optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

const updateAccountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120).optional(),
  type: z.enum(["CASH", "CARD", "BANK"]).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  description: z.string().trim().max(500).optional().nullable(),
});

function canReadFinance(role: string, isImpersonating: boolean): boolean {
  if (isImpersonating) return true;
  return hasPermission("finance.read", "NONE", role);
}

function canWriteFinance(role: string, isImpersonating: boolean): boolean {
  if (isImpersonating) return false;
  return hasPermission("finance.write", "NONE", role);
}

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    if (!canReadFinance(tenantCtx.role, tenantCtx.isImpersonating)) {
      return NextResponse.json(
        { error: "Forbidden: No permission to read center finances" },
        { status: 403 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const accounts = await tenantDb.account.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    const accountsWithBalances = await Promise.all(
      accounts.map(async (acc) => {
        const balance = await calculateAccountBalance(tenantCtx.center.id, acc.id);
        return {
          ...acc,
          balance,
        };
      })
    );

    const totalBalance = accountsWithBalances.reduce((sum, a) => sum + a.balance, 0);

    return NextResponse.json({
      accounts: accountsWithBalances,
      totalBalance,
      currency: "UZS",
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to load accounts", code: error.code },
      { status: error.status || 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    if (!canWriteFinance(tenantCtx.role, tenantCtx.isImpersonating)) {
      return NextResponse.json(
        { error: "Forbidden: No permission to create finance accounts" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`finance_accounts:${tenantCtx.session.user.id}:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const rawBody = await req.json();
    const parsed = createAccountSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid account payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const { name, type, isDefault, description } = parsed.data;

    if (isDefault) {
      await tenantDb.account.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await tenantDb.account.create({
      data: {
        centerId: tenantCtx.center.id,
        name,
        type,
        currency: Currency.UZS,
        isDefault: Boolean(isDefault),
        description: description ?? null,
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "FINANCE_ACCOUNT_CREATED",
      resource: "Account",
      resourceId: created.id,
      details: { name: created.name, type: created.type },
      ipAddress: ip,
    });

    return NextResponse.json({ account: { ...created, balance: 0 } }, { status: 201 });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to create account", code: error.code },
      { status: error.status || 400 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    if (!canWriteFinance(tenantCtx.role, tenantCtx.isImpersonating)) {
      return NextResponse.json(
        { error: "Forbidden: No permission to update finance accounts" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`finance_accounts_patch:${tenantCtx.session.user.id}:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const rawBody = await req.json();
    const parsed = updateAccountSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid account update payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const { id, ...updateFields } = parsed.data;

    if (updateFields.isDefault) {
      await tenantDb.account.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await tenantDb.account.update({
      where: { id },
      data: updateFields,
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "FINANCE_ACCOUNT_UPDATED",
      resource: "Account",
      resourceId: id,
      details: updateFields,
      ipAddress: ip,
    });

    const balance = await calculateAccountBalance(tenantCtx.center.id, id);
    return NextResponse.json({ account: { ...updated, balance } });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to update account", code: error.code },
      { status: error.status || 400 }
    );
  }
}
