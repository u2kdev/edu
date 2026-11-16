import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { assertMaterialAccess, TenantAccessError } from "@/lib/tenant-access";

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    if (tenantCtx.role !== "STUDENT" || !tenantCtx.membership?.id) {
      return NextResponse.json(
        { error: "Forbidden: Only enrolled students can start tests" },
        { status: 403 }
      );
    }

    // Rate limiting: max 20 start requests per minute
    const ip = getClientIp(req);
    const rateLimitKey = `test_start:${tenantCtx.session.user.id}:${ip}`;
    const allowed = await checkRateLimit(rateLimitKey, 20, 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many test attempts, please try again later" },
        { status: 429 }
      );
    }

    const { testId } = await req.json();

    if (!testId) {
      return NextResponse.json({ error: "testId is required" }, { status: 400 });
    }

    const test = await tenantDb.test.findFirst({
      where: { id: testId, centerId: tenantCtx.center.id },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    await assertMaterialAccess(tenantCtx, test.materialId);

    // Check completed attempts
    const completedAttemptsCount = await tenantDb.testAttempt.count({
      where: {
        testId: test.id,
        studentMembershipId: tenantCtx.membership.id,
        completedAt: { not: null },
      },
    });

    if (completedAttemptsCount >= test.maxAttempts) {
      return NextResponse.json(
        {
          error: `Maximum allowed attempts (${test.maxAttempts}) reached for this test.`,
        },
        { status: 400 }
      );
    }

    // Create a new in-progress attempt
    const attempt = await tenantDb.testAttempt.create({
      data: {
        centerId: tenantCtx.center.id,
        testId: test.id,
        studentMembershipId: tenantCtx.membership.id,
        startedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      attemptId: attempt.id,
      startedAt: attempt.startedAt,
      timeLimitMinutes: test.timeLimitMinutes,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: error?.status || 500 }
    );
  }
}
