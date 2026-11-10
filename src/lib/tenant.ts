import { db } from "./db";
import { getAuthSession } from "./auth";
import { getTenantDb } from "./db-tenant";

export async function logAuditEvent(params: {
  centerId?: string;
  actorUserId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.auditLog.create({
      data: {
        centerId: params.centerId,
        actorUserId: params.actorUserId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        detailsJson: params.details ? JSON.stringify(params.details) : undefined,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export class TenantAccessError extends Error {
  status: number;
  code: string;
  constructor(message: string, code: string, status: number = 403) {
    super(message);
    this.name = "TenantAccessError";
    this.code = code;
    this.status = status;
  }
}

export class TenantUnauthorizedError extends TenantAccessError {
  constructor(message: string = "Unauthorized: No session found") {
    super(message, "UNAUTHORIZED", 401);
    this.name = "TenantUnauthorizedError";
  }
}

export class TenantNotFoundError extends TenantAccessError {
  constructor(message: string = "Tenant center not found") {
    super(message, "TENANT_NOT_FOUND", 404);
    this.name = "TenantNotFoundError";
  }
}

export class TenantSuspendedError extends TenantAccessError {
  constructor(status: string) {
    super(`Forbidden: Tenant suspended: ${status}`, "CENTER_SUSPENDED", 403);
    this.name = "TenantSuspendedError";
  }
}

export class TenantMembershipError extends TenantAccessError {
  constructor(message: string = "Forbidden: Active membership required", code: string = "MEMBERSHIP_INACTIVE") {
    super(message, code, 403);
    this.name = "TenantMembershipError";
  }
}

export const CENTER_SUSPENDED_STATUSES = ["BLOCKED", "CANCELLED", "PAUSED", "OVERDUE"] as const;

async function extractReason(
  req: Request,
  options?: { reason?: string }
): Promise<string | undefined> {
  if (options?.reason && typeof options.reason === "string" && options.reason.trim()) {
    return options.reason.trim();
  }
  const headerReason = req.headers.get("x-action-reason") || req.headers.get("x-reason");
  if (headerReason && headerReason.trim()) {
    return headerReason.trim();
  }
  try {
    const url = new URL(req.url);
    const queryReason = url.searchParams.get("reason");
    if (queryReason && queryReason.trim()) return queryReason.trim();
  } catch {}
  try {
    const cloned = req.clone();
    const body = await cloned.json();
    if (body && typeof body.reason === "string" && body.reason.trim()) {
      return body.reason.trim();
    }
  } catch {}
  return undefined;
}

export async function requireTenantAccess(
  req: Request,
  expectedCenterIdOrOptions?: string | { isWrite?: boolean; allowSuspended?: boolean; reason?: string; expectedCenterId?: string },
  maybeOptions?: { isWrite?: boolean; allowSuspended?: boolean; reason?: string; expectedCenterId?: string }
) {
  if (!req || typeof req !== "object" || !("method" in req)) {
    throw new Error("requireTenantAccess requires a Request object as its first argument");
  }

  const options =
    typeof expectedCenterIdOrOptions === "object" ? expectedCenterIdOrOptions : maybeOptions;
  const expectedCenterId =
    typeof expectedCenterIdOrOptions === "string" ? expectedCenterIdOrOptions : options?.expectedCenterId;

  let isWrite = options?.isWrite;
  if (isWrite === undefined) {
    const method = req.method?.toUpperCase();
    isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  }

  const session = await getAuthSession(req);
  if (!session) {
    throw new TenantUnauthorizedError();
  }

  const targetCenterId = expectedCenterId || session.activeCenterId;
  if (!targetCenterId) {
    throw new TenantAccessError("Bad Request: No active learning center selected", "BAD_REQUEST", 400);
  }

  // DEVELOPER, SUPERADMIN & PLATFORM_SUPPORT bypass tenant isolation
  const isPlatformRole =
    session.user.platformRole === "DEVELOPER" ||
    session.user.platformRole === "SUPERADMIN" ||
    session.user.platformRole === "PLATFORM_SUPPORT";

  if (isPlatformRole) {
    const center = await db.learningCenter.findUnique({
      where: { id: targetCenterId },
    });
    if (!center) throw new TenantNotFoundError();

    const isBlockedOrCancelled = center.status === "BLOCKED" || center.status === "CANCELLED";
    if (isBlockedOrCancelled) {
      if (session.user.platformRole !== "SUPERADMIN" && session.user.platformRole !== "DEVELOPER") {
        throw new TenantAccessError(
          `Forbidden: Platform access to ${center.status} centers is restricted to SUPERADMIN and DEVELOPER`,
          "SUSPENDED_ACCESS_DENIED",
          403
        );
      }

      if (isWrite) {
        const reason = await extractReason(req, options);
        if (!reason) {
          throw new TenantAccessError(
            `A reason is required for write operations on ${center.status} centers`,
            "REASON_REQUIRED",
            400
          );
        }

        await logAuditEvent({
          centerId: targetCenterId,
          actorUserId: session.user.id,
          action: "PLATFORM_SUSPENDED_TENANT_WRITE",
          resource: "LearningCenter",
          resourceId: targetCenterId,
          details: {
            platformRole: session.user.platformRole,
            centerStatus: center.status,
            reason,
          },
        });
      }
    }

    if (session.user.platformRole === "PLATFORM_SUPPORT") {
      if (isWrite) {
        throw new TenantAccessError("Forbidden: Platform support has read-only access", "SUPPORT_READ_ONLY", 403);
      }
    }

    await logAuditEvent({
      centerId: targetCenterId,
      actorUserId: session.user.id,
      action: "PLATFORM_TENANT_ACCESS",
      resource: "LearningCenter",
      resourceId: targetCenterId,
      details: {
        platformRole: session.user.platformRole,
        isWrite: !!isWrite,
      },
    });

    const isSupport = session.user.platformRole === "PLATFORM_SUPPORT";
    const platformRole = session.user.platformRole;

    return {
      session,
      center,
      membership: undefined,
      role: platformRole,
      isPlatformStaff: true,
      isReadOnly: isSupport,
      getTenantDb: () => getTenantDb(center.id, { isReadOnly: isSupport }),
    };
  }

  // Standard user check membership in target center from DB
  const membership = await db.centerMembership.findFirst({
    where: {
      userId: session.user.id,
      centerId: targetCenterId,
    },
  });

  if (!membership) {
    throw new TenantMembershipError("Forbidden: You do not have access to this learning center", "FORBIDDEN");
  }

  if (membership.status !== "ACTIVE") {
    throw new TenantMembershipError("Forbidden: Membership is not active", "MEMBERSHIP_INACTIVE");
  }

  if (!session.user.emailVerified) {
    throw new TenantAccessError("Forbidden: Email verification required", "EMAIL_NOT_VERIFIED", 403);
  }

  const center = await db.learningCenter.findUnique({
    where: { id: targetCenterId },
  });

  if (!center) {
    throw new TenantNotFoundError();
  }

  const isSuspendedAllowed = CENTER_SUSPENDED_STATUSES.includes(center.status as (typeof CENTER_SUSPENDED_STATUSES)[number]);
  if (isSuspendedAllowed) {
    if (["PAUSED", "OVERDUE"].includes(center.status) && options?.allowSuspended) {
      if (isWrite) {
        throw new TenantAccessError("Forbidden: Learning center is suspended for write operations", "CENTER_SUSPENDED_WRITE", 403);
      }
    } else {
      throw new TenantSuspendedError(center.status);
    }
  }

  const isReadOnly = isSuspendedAllowed;

  return {
    session,
    center,
    membership,
    role: membership.role,
    isPlatformStaff: false,
    isReadOnly,
    getTenantDb: () => getTenantDb(center.id, { isReadOnly }),
  };
}

export async function requireTenantPageAccess(
  options?: { expectedCenterId?: string; allowSuspended?: boolean }
) {
  const req = new Request("http://localhost/rsc", { method: "GET" });
  return requireTenantAccess(req, options);
}

/**
 * Enforces strict tenant access for center financial routes (/api/finance/*):
 * - Platform roles (SUPERADMIN, DEVELOPER, PLATFORM_SUPPORT, etc.) CANNOT access
 *   center finances without explicit impersonation.
 * - When impersonating (via /api/platform/impersonate session or x-impersonate-center-id header),
 *   access to /api/finance/* is strictly READ-ONLY (write methods return 403 Forbidden)
 *   and every read operation writes a FINANCE_IMPERSONATION_READ entry to AuditLog.
 */
export async function requireFinanceTenantAccess(
  req: Request,
  options?: { isWrite?: boolean; expectedCenterId?: string }
) {
  let isWrite = options?.isWrite;
  if (isWrite === undefined) {
    const method = req.method?.toUpperCase() || "GET";
    isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  }

  const impersonateCenterHeader = req.headers.get("x-impersonate-center-id")?.trim();
  const impersonationReason =
    req.headers.get("x-impersonation-reason")?.trim() ||
    req.headers.get("x-action-reason")?.trim() ||
    "Platform finance audit via impersonation";

  const tenantCtx = await requireTenantAccess(req, {
    ...options,
    expectedCenterId: options?.expectedCenterId || impersonateCenterHeader || undefined,
    isWrite,
  });

  const sessionImpersonatorId = tenantCtx.session.impersonatorUserId;
  const isHeaderImpersonation = Boolean(tenantCtx.isPlatformStaff && impersonateCenterHeader);
  const isSessionImpersonation = Boolean(sessionImpersonatorId);
  const isImpersonating = isHeaderImpersonation || isSessionImpersonation;

  // Platform staff without explicit impersonation cannot view or modify center finances
  if (tenantCtx.isPlatformStaff && !isImpersonating) {
    throw new TenantAccessError(
      "Forbidden: Platform staff cannot access center finances without explicit impersonation",
      "FINANCE_IMPERSONATION_REQUIRED",
      403
    );
  }

  if (isImpersonating) {
    if (isWrite) {
      throw new TenantAccessError(
        "Forbidden: Center finance access during platform impersonation is strictly read-only",
        "FINANCE_IMPERSONATION_READ_ONLY",
        403
      );
    }

    const actorUserId = sessionImpersonatorId || tenantCtx.session.user.id;
    let routePath = "/api/finance";
    try {
      routePath = new URL(req.url).pathname;
    } catch {}

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId,
      action: "FINANCE_IMPERSONATION_READ",
      resource: "CenterFinance",
      resourceId: tenantCtx.center.id,
      details: {
        route: routePath,
        method: req.method,
        impersonatedUserId: isSessionImpersonation ? tenantCtx.session.user.id : null,
        impersonatorUserId: actorUserId,
        reason: impersonationReason,
      },
    });

    return {
      ...tenantCtx,
      isImpersonating: true,
      isReadOnly: true,
      getTenantDb: () => getTenantDb(tenantCtx.center.id, { isReadOnly: true }),
    };
  }

  return {
    ...tenantCtx,
    isImpersonating: false,
  };
}

