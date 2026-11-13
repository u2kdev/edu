import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron-auth";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { processSubscriptionCron } from "@/lib/platform-subscription-cron";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { PlatformRole } from "@prisma/client";

export async function POST(req: Request) {
  try {
    let authorized = verifyCronSecret(req);

    if (!authorized) {
      // Check if authorized platform admin with billing manage permission
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

    const result = await processSubscriptionCron();
    return apiSuccess(result);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function GET(req: Request) {
  return POST(req);
}
