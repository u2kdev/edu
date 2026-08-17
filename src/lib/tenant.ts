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
  if (center.status === "BLOCKED") {
    throw new Error("Tenant Blocked: Learning center has been suspended by platform administration.");
  }

  if (center.status === "CANCELLED") {
    throw new Error("Tenant Cancelled: Learning center subscription has been cancelled.");
  }

  if (center.status === "PAUSED" && membership.role !== "DIRECTOR" && membership.role !== "CENTER_ADMIN") {
    throw new Error("Tenant Paused: Learning center is temporarily paused. Please contact your administrator.");
  }

  if (center.status === "OVERDUE" && membership.role !== "DIRECTOR" && membership.role !== "CENTER_ADMIN") {
    throw new Error("Payment Overdue: Learning center has overdue payments. Please contact your administrator.");
  }

  // Legacy: FROZEN status (maps to PAUSED behavior)
  if (center.status === "FROZEN" && membership.role !== "DIRECTOR") {
    throw new Error("Tenant Frozen: Learning center subscription has expired. Please contact center administration.");
  }


  return {
    session,
    center,
    membership,
    role: membership.role,
    isPlatformStaff: false,
  };
}
