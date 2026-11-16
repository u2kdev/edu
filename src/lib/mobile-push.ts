import { Expo, type ExpoPushMessage, type ExpoPushTicket } from "expo-server-sdk";
import type { NotificationType } from "@prisma/client";
// Reason: Exception: Push token operations operate on platform user devices.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";

export interface DispatchMobilePushOptions {
  userId: string;
  centerId?: string | null;
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
  expoClient?: Pick<Expo, "chunkPushNotifications" | "sendPushNotificationsAsync">;
  type?: NotificationType;
  eventKey?: string;
  skipDeliveryLog?: boolean;
}

export interface DispatchPushResult {
  sent: boolean;
  tokensCount: number;
  recipientTokens: string[];
  deliveredCount?: number;
  removedInvalidTokensCount?: number;
  deliveryId?: string;
  reason?: string;
}

let cachedExpoClient: Expo | null = null;
function getExpoClient(): Expo {
  if (!cachedExpoClient) {
    const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
    cachedExpoClient = new Expo(accessToken ? { accessToken } : undefined);
  }
  return cachedExpoClient;
}

function maskPushToken(token: string): string {
  if (token.length <= 16) return "[EXPO_TOKEN]";
  return `${token.slice(0, 18)}...${token.slice(-4)}`;
}

async function recordPushDelivery(params: {
  userId: string;
  centerId?: string | null;
  type: NotificationType;
  eventKey?: string;
  recipient: string;
  subject: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  providerMessageId?: string | null;
  errorMessage?: string | null;
}): Promise<string | undefined> {
  try {
    const row = await db.notificationDelivery.create({
      data: {
        userId: params.userId,
        centerId: params.centerId ?? null,
        channel: "PUSH",
        type: params.type,
        eventKey: params.eventKey ?? null,
        recipient: params.recipient,
        subject: params.subject,
        status: params.status,
        providerMessageId: params.providerMessageId ?? null,
        errorMessage: params.errorMessage ?? null,
        sentAt: params.status === "SENT" ? new Date() : null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (err) {
    console.error("[Mobile Push] Failed to write NotificationDelivery:", err);
    return undefined;
  }
}

/**
 * Dispatches a push notification via Expo SDK with strict tenant isolation,
 * active status enforcement, chunking, ticket checking, and stale DeviceNotRegistered cleanup.
 */
export async function dispatchMobilePush(
  options: DispatchMobilePushOptions
): Promise<DispatchPushResult> {
  const {
    userId,
    centerId,
    title,
    body,
    data,
    expoClient,
    type = "GENERAL",
    eventKey,
    skipDeliveryLog = false,
  } = options;

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
      return {
        sent: false,
        tokensCount: 0,
        recipientTokens: [],
        reason: "CENTER_SUSPENDED_OR_INACTIVE",
      };
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
  const maskedRecipient = recipientTokens.map(maskPushToken).join(", ");

  // In test mode without an explicit expoClient stub, avoid external network requests
  // while preserving delivery logging and deterministic return shapes for unit/isolation tests.
  if (process.env.NODE_ENV === "test" && !expoClient) {
    const deliveryId = !skipDeliveryLog
      ? await recordPushDelivery({
          userId,
          centerId,
          type,
          eventKey,
          recipient: maskedRecipient,
          subject: title,
          status: "SENT",
          providerMessageId: `test_push_${Date.now()}`,
        })
      : undefined;

    return {
      sent: true,
      tokensCount: recipientTokens.length,
      recipientTokens,
      deliveredCount: recipientTokens.length,
      removedInvalidTokensCount: 0,
      deliveryId,
    };
  }

  const client = expoClient ?? getExpoClient();
  const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t.pushToken));
  const malformedTokens = tokens.filter((t) => !Expo.isExpoPushToken(t.pushToken));

  let removedInvalidTokensCount = 0;
  if (malformedTokens.length > 0) {
    await db.devicePushToken.deleteMany({
      where: { id: { in: malformedTokens.map((t) => t.id) } },
    });
    removedInvalidTokensCount += malformedTokens.length;
  }

  if (validTokens.length === 0) {
    const deliveryId = !skipDeliveryLog
      ? await recordPushDelivery({
          userId,
          centerId,
          type,
          eventKey,
          recipient: maskedRecipient,
          subject: title,
          status: "FAILED",
          errorMessage: "NO_VALID_EXPO_TOKENS",
        })
      : undefined;

    return {
      sent: false,
      tokensCount: 0,
      recipientTokens: [],
      deliveredCount: 0,
      removedInvalidTokensCount,
      deliveryId,
      reason: "NO_VALID_EXPO_TOKENS",
    };
  }

  const messages: ExpoPushMessage[] = validTokens.map((tokenRow) => ({
    to: tokenRow.pushToken,
    sound: "default",
    title,
    body,
    data: data as Record<string, unknown> | undefined,
  }));

  const chunks = client.chunkPushNotifications(messages);
  const deadTokenIds: string[] = [];
  const okTicketIds: string[] = [];
  const errorMessages: string[] = [];

  let offset = 0;
  for (const chunk of chunks) {
    try {
      const tickets: ExpoPushTicket[] = await client.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, idx) => {
        const tokenRow = validTokens[offset + idx];
        if (ticket.status === "ok") {
          okTicketIds.push(ticket.id);
        } else {
          if (ticket.details?.error === "DeviceNotRegistered" && tokenRow) {
            deadTokenIds.push(tokenRow.id);
          }
          if (ticket.message) {
            errorMessages.push(ticket.message);
          }
        }
      });
    } catch (err) {
      errorMessages.push(err instanceof Error ? err.message : String(err));
    }
    offset += chunk.length;
  }

  if (deadTokenIds.length > 0) {
    await db.devicePushToken.deleteMany({
      where: { id: { in: deadTokenIds } },
    });
    removedInvalidTokensCount += deadTokenIds.length;
  }

  const deliveredCount = okTicketIds.length;
  const sent = deliveredCount > 0;
  const deliveryId = !skipDeliveryLog
    ? await recordPushDelivery({
        userId,
        centerId,
        type,
        eventKey,
        recipient: validTokens.map((t) => maskPushToken(t.pushToken)).join(", "),
        subject: title,
        status: sent ? "SENT" : "FAILED",
        providerMessageId: okTicketIds.slice(0, 5).join(",") || null,
        errorMessage: errorMessages.length > 0 ? errorMessages.join("; ").slice(0, 500) : null,
      })
    : undefined;

  return {
    sent,
    tokensCount: validTokens.length,
    recipientTokens: validTokens.map((t) => t.pushToken),
    deliveredCount,
    removedInvalidTokensCount,
    deliveryId,
    ...(sent ? {} : { reason: errorMessages[0] || "EXPO_PUSH_FAILED" }),
  };
}
