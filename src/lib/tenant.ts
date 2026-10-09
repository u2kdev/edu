import { db } from "./db";
import { getAuthSession } from "./auth";

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
  expectedCenterId?: string,
  options?: { isWrite?: boolean; allowSuspended?: boolean }
) {
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
      if (options?.isWrite) {
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
        isWrite: !!options?.isWrite,
      },
    });

    const isSupport = session.user.platformRole === "PLATFORM_SUPPORT";
    return {
      session,
      center,
      role: isSupport ? "CENTER_SUPPORT" : (session.activeCenterRole || "DIRECTOR"),
      isPlatformStaff: true,
      isReadOnly: isSupport,
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

  const center = await db.learningCenter.findUnique({
    where: { id: targetCenterId },
  });

  if (!center) {
    throw new TenantNotFoundError();
  }

  // Check center status
  if (CENTER_SUSPENDED_STATUSES.includes(center.status as (typeof CENTER_SUSPENDED_STATUSES)[number])) {
    if (["PAUSED", "OVERDUE"].includes(center.status) && options?.allowSuspended) {
      // Allowed for status/resume reading page
    } else {
      throw new TenantSuspendedError(center.status);
    }
  }

  return {
    session,
    center,
    membership,
    role: membership.role,
    isPlatformStaff: false,
  };
}
