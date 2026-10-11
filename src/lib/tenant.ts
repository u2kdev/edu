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

export async function requireTenantAccess(
  req: Request,
  expectedCenterIdOrOptions?: string | { isWrite?: boolean; allowSuspended?: boolean },
  maybeOptions?: { isWrite?: boolean; allowSuspended?: boolean }
) {
  if (!req || typeof req !== "object" || !("method" in req)) {
    throw new Error("requireTenantAccess requires a Request object as its first argument");
  }

  const expectedCenterId =
    typeof expectedCenterIdOrOptions === "string" ? expectedCenterIdOrOptions : undefined;
  const options =
    typeof expectedCenterIdOrOptions === "object" ? expectedCenterIdOrOptions : maybeOptions;

  let isWrite = options?.isWrite;
  if (isWrite === undefined) {
    const method = req.method?.toUpperCase();
    isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  }

  const session = await getAuthSession();
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
