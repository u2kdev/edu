import { NextResponse } from "next/server";
import { cleanupExpiredRateLimits } from "@/lib/rate-limit";
import { cleanupEmailOutbox } from "@/lib/email";
import { verifyCronSecret } from "@/lib/cron-auth";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { withAdvisoryLock } from "@/lib/cron-lock";

const CRON_CLEANUP_LOCK = 8801;

export async function POST(req: Request) {
  try {
    if (!verifyCronSecret(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const lockResult = await withAdvisoryLock(CRON_CLEANUP_LOCK, async () => {
      const rateLimitsCleaned = await cleanupExpiredRateLimits();
      const emailOutboxCleaned = await cleanupEmailOutbox(30);
      return {
        rateLimitsCleaned,
        emailOutboxCleaned,
      };
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
