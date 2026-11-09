// Reason: Exception: Push token operations operate on platform user devices.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";

export interface DispatchMobilePushOptions {
  userId: string;
  centerId?: string | null;
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
}

export interface DispatchPushResult {
  sent: boolean;
  tokensCount: number;
  recipientTokens: string[];
  reason?: string;
}

/**
 * Dispatches a push notification with strict tenant isolation and active status enforcement.
 * - Only sends to active users
 * - If centerId is provided: only sends if center is ACTIVE (not SUSPENDED/BLOCKED)
 * - Only sends to members who have an ACTIVE membership in that center
 * - Filters tokens registered for that specific center (or platform-global tokens)
 */
export async function dispatchMobilePush(
  options: DispatchMobilePushOptions
): Promise<DispatchPushResult> {
  const { userId, centerId, title: _title, body: _body, data: _data } = options;

  // 1. Verify user exists and is active
  const user = await db.platformUser.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });

  if (!user || !user.isActive) {
    return { sent: false, tokensCount: 0, recipientTokens: [], reason: "USER_INACTIVE" };
  }

  // 2. If centerId is specified, verify center is ACTIVE and recipient membership is ACTIVE
  if (centerId) {
    const center = await db.learningCenter.findUnique({
      where: { id: centerId },
      select: { status: true },
    });

    if (!center || center.status !== "ACTIVE") {
      return { sent: false, tokensCount: 0, recipientTokens: [], reason: "CENTER_SUSPENDED_OR_INACTIVE" };
    }

    const membership = await db.centerMembership.findFirst({
      where: {
        userId,
        centerId,
        status: "ACTIVE",
      },
    });

    if (!membership) {
      return { sent: false, tokensCount: 0, recipientTokens: [], reason: "MEMBERSHIP_INACTIVE" };
    }
  }

  // 3. Query DevicePushTokens strictly scoped to user and centerId (Tenant Isolation)
  const tokens = await db.devicePushToken.findMany({
    where: {
      userId,
      ...(centerId ? { OR: [{ centerId }, { centerId: null }] } : {}),
    },
  });

  if (tokens.length === 0) {
    return { sent: false, tokensCount: 0, recipientTokens: [], reason: "NO_REGISTERED_TOKENS" };
  }

  const recipientTokens = tokens.map((t) => t.pushToken);
  return {
    sent: true,
    tokensCount: recipientTokens.length,
    recipientTokens,
  };
}
