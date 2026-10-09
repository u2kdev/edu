import { NextResponse } from "next/server";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";

const deleteSessionSchema = z.object({
  id: z.string().optional(),
  allButCurrent: z.preprocess((v) => v === "true" || v === true, z.boolean().optional()),
}).refine(data => data.id || data.allButCurrent, {
  message: "Either id or allButCurrent must be provided",
});

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) return apiError("Too many requests", "RATE_LIMITED", 429);

    const session = await getAuthSession();
    if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const sessions = await db.userSession.findMany({
      where: { userId: session.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
      }
    });

    return apiSuccess({
      sessions: sessions.map((s) => ({
        ...s,
        isCurrent: s.id === session.sessionId
      }))
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip)) return apiError("Too many requests", "RATE_LIMITED", 429);

    const session = await getAuthSession();
    if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const { searchParams } = new URL(req.url);
    const parsed = deleteSessionSchema.parse(Object.fromEntries(searchParams.entries()));
    const { id, allButCurrent } = parsed;

    if (allButCurrent && session.sessionId) {
      await db.userSession.updateMany({
        where: {
          userId: session.user.id,
          id: { not: session.sessionId },
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
      
      await db.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "LOGOUT_ALL",
          resource: "PlatformUser",
          resourceId: session.user.id,
          ipAddress: ip,
        }
      });
      
      return apiSuccess({ success: true });
    }

    if (id) {
      const userSession = await db.userSession.findFirst({
        where: { id, userId: session.user.id }
      });

      if (!userSession) return apiError("Session not found", "NOT_FOUND", 404);

      await db.userSession.update({
        where: { id },
        data: { revokedAt: new Date() }
      });

      await db.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "SESSION_REVOKED",
          resource: "UserSession",
          resourceId: id,
          ipAddress: ip,
        }
      });

      return apiSuccess({ success: true });
    }

    return apiError("Bad request", "BAD_REQUEST", 400);
  } catch (err: any) {
    return handleApiError(err);
  }
}
