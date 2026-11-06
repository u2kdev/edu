// Reason: Exception: Push token operations operate on platform user devices.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { registerPushTokenSchema } from "@/lib/validation/mobile";
import { getClientIp } from "@/lib/ip";

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const ip = getClientIp(req);
    const body = await req.json();
    const { pushToken, platform, deviceInfo } = registerPushTokenSchema.parse(body);

    const record = await db.devicePushToken.upsert({
      where: { pushToken },
      create: {
        userId: session.user.id,
        platform,
        pushToken,
        deviceInfo,
      },
      update: {
        userId: session.user.id,
        platform,
        deviceInfo,
      },
    });

    try {
      await db.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "DEVICE_PUSH_TOKEN_REGISTERED",
          resource: "DevicePushToken",
          resourceId: record.id,
          detailsJson: JSON.stringify({ platform, deviceInfo, ip }),
          ipAddress: ip,
        },
      });
    } catch {}

    return apiSuccess({
      registered: true,
      id: record.id,
      platform: record.platform,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
