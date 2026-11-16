import { NextResponse } from "next/server";
import { processEmailOutbox } from "@/lib/email";
import { verifyCronSecret } from "@/lib/cron-auth";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { withAdvisoryLock } from "@/lib/cron-lock";

const CRON_EMAIL_OUTBOX_LOCK = 8802;

export async function POST(req: Request) {
  try {
    if (!verifyCronSecret(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const lockResult = await withAdvisoryLock(CRON_EMAIL_OUTBOX_LOCK, async () => {
      return await processEmailOutbox({ batchSize: 50 });
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
