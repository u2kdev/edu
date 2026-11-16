import { NextResponse } from "next/server";
import { PlatformRole } from "@prisma/client";
import { verifyCronSecret } from "@/lib/cron-auth";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { withAdvisoryLock } from "@/lib/cron-lock";
import { runPaymentRemindersCron } from "@/lib/payment-reminders";

const CRON_PAYMENT_REMINDERS_LOCK = 8805;

export async function POST(req: Request) {
  try {
    let authorized = verifyCronSecret(req);

    if (!authorized) {
      const session = await getAuthSession();
      if (
        session?.user?.platformRole &&
        Object.values(PlatformRole).includes(session.user.platformRole as PlatformRole) &&
        hasPermission("platform.billing.manage", session.user.platformRole as PlatformRole)
      ) {
        authorized = true;
      }
    }

    if (!authorized && process.env.NODE_ENV !== "test") {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const lockResult = await withAdvisoryLock(CRON_PAYMENT_REMINDERS_LOCK, async () => {
      return await runPaymentRemindersCron();
    });

    if (!lockResult.executed) {
      return apiSuccess({ skipped: true, reason: lockResult.reason });
    }

    return apiSuccess(lockResult.result);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function GET(req: Request) {
  return POST(req);
}
