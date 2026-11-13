import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const revokeActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("REVOKE_USER_SESSIONS"),
    userId: z.string().uuid(),
    reason: z.string().min(5, "Reason must be at least 5 characters").optional().default("Revoked by center director"),
  }),
  z.object({
    action: z.literal("REVOKE_SESSION"),
    sessionId: z.string().uuid(),
    reason: z.string().min(5, "Reason must be at least 5 characters").optional().default("Revoked by center director"),
  }),
]);

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!hasPermission("audit.read", tenantCtx.session.user.platformRole, tenantCtx.role)) {
      return NextResponse.json({ error: "Forbidden: No permission to read activity" }, { status: 403 });
    }
    const centerId = tenantCtx.center.id;

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase().trim();

    // 1. Fetch center members
    const members = await tenantCtx.getTenantDb().centerMembership.findMany({
      where: {
        centerId,
        ...(role && role !== "ALL" ? { role: role as never } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const userIds = members.map((m) => m.user.id);
    const now = new Date();

    // 2. Fetch active sessions for these users
    const activeSessions = await tenantCtx.getTenantDb().userSession.findMany({
      where: {
        userId: { in: userIds },
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        userId: true,
        deviceId: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: "desc" },
    });

    const sessionsByUser = new Map<string, typeof activeSessions>();
    for (const sess of activeSessions) {
      const list = sessionsByUser.get(sess.userId) || [];
      list.push(sess);
      sessionsByUser.set(sess.userId, list);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let users = members.map((m) => {
      const userSessions = sessionsByUser.get(m.user.id) || [];
      const isOnline = userSessions.some(
        (s) => now.getTime() - s.lastSeenAt.getTime() < 15 * 60 * 1000
      );
      const neverLoggedIn = !m.user.lastLoginAt;
      const inactiveOver7Days =
        !neverLoggedIn && m.user.lastLoginAt ? m.user.lastLoginAt < sevenDaysAgo : false;

      return {
        id: m.id,
        userId: m.user.id,
        fullName: m.user.fullName,
        email: m.user.email,
        phone: m.user.phone,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        memberStatus: m.status,
        lastLoginAt: m.user.lastLoginAt,
        activeSessionsCount: userSessions.length,
        isOnline,
        neverLoggedIn,
        inactiveOver7Days,
        sessions: userSessions,
      };
    });

    if (search) {
      users = users.filter(
        (u) =>
          u.fullName.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search) ||
          (u.phone && u.phone.includes(search))
      );
    }

    if (status === "ONLINE") {
      users = users.filter((u) => u.activeSessionsCount > 0);
    } else if (status === "NEVER") {
      users = users.filter((u) => u.neverLoggedIn);
    } else if (status === "INACTIVE_7D") {
      users = users.filter((u) => u.inactiveOver7Days);
    }

    const summary = {
      totalMembers: members.length,
      onlineNow: users.filter((u) => u.isOnline).length,
      hasActiveSessions: users.filter((u) => u.activeSessionsCount > 0).length,
      neverLoggedIn: members.filter((m) => !m.user.lastLoginAt).length,
      inactiveOver7Days: members.filter(
        (m) => m.user.lastLoginAt && m.user.lastLoginAt < sevenDaysAgo
      ).length,
    };

    return NextResponse.json(
      { users, summary },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!hasPermission("audit.read", tenantCtx.session.user.platformRole, tenantCtx.role)) {
      return NextResponse.json({ error: "Forbidden: No permission to revoke sessions" }, { status: 403 });
    }
    const centerId = tenantCtx.center.id;

    const body = await req.json();
    const parsed = revokeActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const actionData = parsed.data;

    if (actionData.action === "REVOKE_USER_SESSIONS") {
      // 1. Strict tenant check: verify target user has membership in this center
      const member = await tenantCtx.getTenantDb().centerMembership.findFirst({
        where: { centerId, userId: actionData.userId },
        include: { user: { select: { fullName: true, email: true } } },
      });

      if (!member) {
        return NextResponse.json(
          { error: "Access denied: User does not belong to this learning center" },
          { status: 403 }
        );
      }

      const res = await tenantCtx.getTenantDb().userSession.updateMany({
        where: { userId: actionData.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tenantCtx.getTenantDb().auditLog.create({
        data: {
          centerId,
          actorUserId: tenantCtx.session.user.id,
          action: "USER_SESSIONS_REVOKED",
          resource: "PlatformUser",
          resourceId: actionData.userId,
          detailsJson: JSON.stringify({
            targetUserName: member.user.fullName,
            revokedCount: res.count,
            reason: actionData.reason,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        revokedCount: res.count,
        message: `Successfully terminated ${res.count} active session(s) for ${member.user.fullName}`,
      });
    }

    if (actionData.action === "REVOKE_SESSION") {
      // 1. Find the session and verify owner is in this center
      const sessionToRevoke = await tenantCtx.getTenantDb().userSession.findUnique({
        where: { id: actionData.sessionId },
        include: {
          user: {
            include: {
              memberships: {
                where: { centerId },
              },
            },
          },
        },
      });

      if (!sessionToRevoke || sessionToRevoke.user.memberships.length === 0) {
        return NextResponse.json(
          { error: "Access denied: Session does not belong to a member of this center" },
          { status: 403 }
        );
      }

      await tenantCtx.getTenantDb().userSession.update({
        where: { id: actionData.sessionId },
        data: { revokedAt: new Date() },
      });

      await tenantCtx.getTenantDb().auditLog.create({
        data: {
          centerId,
          actorUserId: tenantCtx.session.user.id,
          action: "SESSION_REVOKED",
          resource: "UserSession",
          resourceId: actionData.sessionId,
          detailsJson: JSON.stringify({
            userId: sessionToRevoke.userId,
            reason: actionData.reason,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Session successfully terminated",
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
