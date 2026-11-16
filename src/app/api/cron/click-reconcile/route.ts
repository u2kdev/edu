import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { withAdvisoryLock } from "@/lib/cron-lock";
import { reconcileStaleClickIntents } from "@/lib/click";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PlatformRole } from "@prisma/client";

const CRON_CLICK_RECONCILE_LOCK = 8804;

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

    const lockResult = await withAdvisoryLock(CRON_CLICK_RECONCILE_LOCK, async () => {
      return await reconcileStaleClickIntents();
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
