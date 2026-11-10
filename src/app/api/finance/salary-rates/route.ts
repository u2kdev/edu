import { NextResponse } from "next/server";
import { z } from "zod";
import { Currency } from "@prisma/client";
import { requireFinanceTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const salaryRateSchema = z.object({
  teacherMembershipId: z.string().uuid(),
  groupId: z.string().uuid().optional().nullable(),
  rateType: z.enum(["HOURLY", "PERCENTAGE", "FIXED"]).default("HOURLY"),
  amount: z.number().int().positive("Salary rate amount must be a positive integer"),
  isActive: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canRead =
      tenantCtx.isImpersonating || hasPermission("finance.read", "NONE", tenantCtx.role);
    if (!canRead) {
      return NextResponse.json(
        { error: "Forbidden: No permission to read teacher salary rates" },
        { status: 403 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const rates = await tenantDb.teacherSalaryRate.findMany({
      include: {
        teacher: {
          select: {
            id: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        group: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ rates });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to load salary rates", code: error.code },
      { status: error.status || 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canWrite =
      !tenantCtx.isImpersonating && hasPermission("finance.write", "NONE", tenantCtx.role);
    if (!canWrite) {
      return NextResponse.json(
        { error: "Forbidden: No permission to manage teacher salary rates" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`finance_salary_rates:${tenantCtx.session.user.id}:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const rawBody = await req.json();
    const parsed = salaryRateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid salary rate payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.rateType === "PERCENTAGE" && data.amount > 100) {
      return NextResponse.json(
        { error: "Percentage rate cannot exceed 100" },
        { status: 400 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const teacherMem = await tenantDb.centerMembership.findFirst({
      where: {
        id: data.teacherMembershipId,
        role: { in: ["TEACHER", "TEACHER_ASSISTANT", "DIRECTOR"] },
      },
    });
    if (!teacherMem) {
      return NextResponse.json(
        { error: "Teacher membership not found in this center" },
        { status: 404 }
      );
    }

    const existing = await tenantDb.teacherSalaryRate.findFirst({
      where: {
        teacherMembershipId: data.teacherMembershipId,
        groupId: data.groupId ?? null,
      },
    });

    const rate = existing
      ? await tenantDb.teacherSalaryRate.update({
          where: { id: existing.id },
          data: {
            rateType: data.rateType,
            amount: data.amount,
            isActive: data.isActive ?? true,
          },
        })
      : await tenantDb.teacherSalaryRate.create({
          data: {
            centerId: tenantCtx.center.id,
            teacherMembershipId: data.teacherMembershipId,
            groupId: data.groupId ?? null,
            rateType: data.rateType,
            amount: data.amount,
            currency: Currency.UZS,
            isActive: data.isActive ?? true,
          },
        });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "FINANCE_SALARY_RATE_SAVED",
      resource: "TeacherSalaryRate",
      resourceId: rate.id,
      details: {
        teacherMembershipId: rate.teacherMembershipId,
        groupId: rate.groupId,
        rateType: rate.rateType,
        amount: rate.amount,
      },
      ipAddress: ip,
    });

    return NextResponse.json({ rate }, { status: existing ? 200 : 201 });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to save salary rate", code: error.code },
      { status: error.status || 400 }
    );
  }
}
