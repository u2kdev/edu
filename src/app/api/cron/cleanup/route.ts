import { NextResponse } from "next/server";
import { cleanupExpiredRateLimits } from "@/lib/rate-limit";
import { cleanupEmailOutbox } from "@/lib/email";
import { verifyCronSecret } from "@/lib/cron-auth";
import { apiSuccess, handleApiError } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    if (!verifyCronSecret(req)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitsCleaned = await cleanupExpiredRateLimits();
    const emailOutboxCleaned = await cleanupEmailOutbox(30);

    return apiSuccess({
      rateLimitsCleaned,
      emailOutboxCleaned,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function GET(req: Request) {
  return POST(req);
}
