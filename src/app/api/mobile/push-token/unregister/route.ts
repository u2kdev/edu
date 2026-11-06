// Reason: Exception: Push token operations operate on platform user devices.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { unregisterPushTokenSchema } from "@/lib/validation/mobile";
import { getClientIp } from "@/lib/ip";

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const ip = getClientIp(req);
    const body = await req.json();
    const { pushToken } = unregisterPushTokenSchema.parse(body);

    const result = await db.devicePushToken.deleteMany({
      where: {
        pushToken,
        userId: session.user.id,
      },
    });

    try {
      await db.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "DEVICE_PUSH_TOKEN_UNREGISTERED",
          resource: "DevicePushToken",
          detailsJson: JSON.stringify({ pushToken, deletedCount: result.count, ip }),
          ipAddress: ip,
        },
      });
    } catch {}

    return apiSuccess({
      unregistered: true,
      count: result.count,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
