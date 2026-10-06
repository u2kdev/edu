import { db } from "./db";
import { getAuthSession } from "./auth";

export async function logAuditEvent(params: {
  centerId?: string;
  actorUserId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
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

export async function requireTenantAccess(expectedCenterId?: string) {
  const session = await getAuthSession();
  if (!session) {
    throw new Error("Unauthorized: No session found");
  }

  const targetCenterId = expectedCenterId || session.activeCenterId;
  if (!targetCenterId) {
    throw new Error("Bad Request: No active learning center selected");
  }

  // DEVELOPER, SUPERADMIN & Platform Support bypass tenant isolation for impersonation/support
  if (
    session.user.platformRole === "DEVELOPER" ||
    session.user.platformRole === "SUPERADMIN" ||
    session.user.platformRole === "PLATFORM_SUPPORT" ||
    session.user.platformRole === "FULL_ACCESS"
  ) {
    const center = await db.learningCenter.findUnique({
      where: { id: targetCenterId },
    });
    if (!center) throw new Error("Tenant center not found");
    return {
      session,
      center,
      role: session.activeCenterRole || "DIRECTOR",
      isPlatformStaff: true,
    };
  }

  // Standard user check membership in target center
  const membership = session.memberships.find((m) => m.centerId === targetCenterId);
  if (!membership) {
    throw new Error("Forbidden: You do not have access to this learning center");
  }

  const center = await db.learningCenter.findUnique({
    where: { id: targetCenterId },
  });

  if (!center) {
    throw new Error("Tenant center not found");
  }

  // Check center status
  if (["BLOCKED", "CANCELLED", "PAUSED", "OVERDUE", "FROZEN"].includes(center.status)) {
    // If it's a specific status that some roles can still access, allow them
    if ((center.status === "PAUSED" || center.status === "OVERDUE" || center.status === "FROZEN") && 
        (membership.role === "DIRECTOR" || membership.role === "CENTER_ADMIN")) {
      // allow
    } else {
      const err: any = new Error(`Forbidden: Tenant suspended: ${center.status}`);
      err.status = 403;
      err.code = "CENTER_SUSPENDED";
      throw err;
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
