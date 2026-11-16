// Reason: Exception: Guard inspects global PlatformUser memberships across centers.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import type { CenterRole } from "@/lib/permissions";

export interface UserAccountManageability {
  canManage: boolean;
  isShared: boolean;
  reason?: string;
  otherCenterCount: number;
}

/**
 * Checks whether an actor in actorCenterId is permitted to manage the global PlatformUser credentials
 * (password, email, phone, username).
 *
 * Rule: PlatformUser is global. A director may change password/email/phone/username ONLY if ALL active
 * memberships of this user belong strictly to actorCenterId.
 * If user has active memberships in other centers or is a platform role user, credentials can only be changed
 * by the user themselves.
 */
export async function canManageUserAccount(
  actorCenterId: string,
  targetUserId: string,
  prismaClient: typeof db = db
): Promise<UserAccountManageability> {
  if (!targetUserId) {
    return {
      canManage: false,
      isShared: false,
      otherCenterCount: 0,
      reason: "User not found",
    };
  }
  const user = await prismaClient.platformUser.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      platformRole: true,
      memberships: {
        where: {
          status: "ACTIVE",
        },
        select: {
          id: true,
          centerId: true,
          role: true,
        },
      },
    },
  });

  if (!user) {
    return {
      canManage: false,
      isShared: false,
      reason: "Пользователь не найден",
      otherCenterCount: 0,
    };
  }

  // If user has platform-level privileges, center director cannot manage credentials
  if (user.platformRole && user.platformRole !== "NONE") {
    return {
      canManage: false,
      isShared: true,
      reason: "Пользователь обладает ролью платформы, смена доступа возможна только им самим",
      otherCenterCount: 0,
    };
  }

  const otherCenterMemberships = user.memberships.filter(
    (m) => m.centerId !== actorCenterId
  );

  if (otherCenterMemberships.length > 0) {
    return {
      canManage: false,
      isShared: true,
      reason:
        "Пользователь состоит в нескольких центрах, смена доступа возможна только самим пользователем",
      otherCenterCount: otherCenterMemberships.length,
    };
  }

  return {
    canManage: true,
    isShared: false,
    otherCenterCount: 0,
  };
}

/**
 * Checks if actorRole has permission to manage targetRole in this center.
 * Rule: CENTER_ADMIN cannot manage DIRECTOR or other CENTER_ADMINs.
 * Only DIRECTOR (or platform staff) can manage CENTER_ADMIN.
 * No center role can manage DIRECTOR.
 */
export function canActorManageRole(
  actorRole: CenterRole | string,
  targetRole: CenterRole | string,
  isPlatformStaff = false
): { allowed: boolean; reason?: string } {
  if (isPlatformStaff) {
    return { allowed: true };
  }

  if (targetRole === "DIRECTOR") {
    return {
      allowed: false,
      reason: "Управление учётной записью директора запрещено в рамках центра",
    };
  }

  if (actorRole === "CENTER_ADMIN") {
    if (targetRole === "CENTER_ADMIN" || targetRole === "DIRECTOR" || targetRole === "ACCOUNTANT") {
      return {
        allowed: false,
        reason: "Администратор центра не может управлять другими администраторами, бухгалтером или директором",
      };
    }
    return { allowed: true };
  }

  if (actorRole === "DIRECTOR") {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "Недостаточно прав для выполнения действия",
  };
}
