import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError, logAuditEvent } from "@/lib/tenant";
import { isActorImpersonating } from "@/lib/tenant-access";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import {
  resolveUserNotificationPreferences,
  resolveUserQuietHours,
  serializeNotificationPrefsJson,
  NotificationPreferences,
  NotificationChannelType,
} from "@/lib/notifications";
// Reason: Exception: Account self-service operates on platformUser and learningCenter settings scoped by session.user.id and active center.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { z } from "zod";

const channelEnum = z.enum(["IN_APP", "EMAIL", "PUSH", "SMS", "TELEGRAM"]);

const preferencesSchema = z
  .object({
    attendance: z.array(channelEnum).optional(),
    grades: z.array(channelEnum).optional(),
    homework: z.array(channelEnum).optional(),
    payments: z.array(channelEnum).optional(),
    announcements: z.array(channelEnum).optional(),
  })
  .strict();

const quietHoursSchema = z
  .object({
    enabled: z.boolean(),
    start: z.number().int().min(0).max(23),
    end: z.number().int().min(0).max(23),
  })
  .strict();

const updateNotificationPrefsSchema = z
  .object({
    preferences: preferencesSchema.optional(),
    quietHours: quietHoursSchema.optional(),
    // Center-level settings (DIRECTOR / CENTER_ADMIN only)
    smsEnabled: z.boolean().optional(),
    smsDailyLimit: z.number().int().min(0).max(100000).optional(),
    centerDefaultPreferences: preferencesSchema.optional(),
  })
  .strict();

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function resolvePrefsActor(req: Request, isWrite: boolean) {
  const rawSession = await getAuthSession(req);
  if (!rawSession) {
    throw new TenantAccessError("Unauthorized: No session found", "UNAUTHORIZED", 401);
  }

  if (rawSession.activeCenterId) {
    const tenantCtx = await requireTenantAccess(req, { isWrite });
    return {
      session: tenantCtx.session,
      role: tenantCtx.role,
      centerId: tenantCtx.center.id as string | undefined,
      isPlatformStaff: tenantCtx.isPlatformStaff,
      isReadOnly: isActorImpersonating(tenantCtx) || Boolean(tenantCtx.session.isReadOnly),
    };
  }

  const readOnly =
    Boolean(rawSession.isReadOnly) ||
    Boolean(rawSession.impersonatorUserId) ||
    rawSession.user.platformRole === "PLATFORM_SUPPORT";

  if (isWrite && readOnly) {
    throw new TenantAccessError("Read-only impersonation mode", "FORBIDDEN", 403);
  }

  return {
    session: rawSession,
    role: rawSession.user.platformRole || "NONE",
    centerId: undefined as string | undefined,
    isPlatformStaff: rawSession.user.platformRole !== "NONE",
    isReadOnly: readOnly,
  };
}

export async function GET(req: Request) {
  try {
    const actor = await resolvePrefsActor(req, false);

    const [userRecord, centerRecord] = await Promise.all([
      db.platformUser.findUnique({
        where: { id: actor.session.user.id },
        select: {
          id: true,
          notificationPrefsJson: true,
        },
      }),
      actor.centerId
        ? db.learningCenter.findUnique({
            where: { id: actor.centerId },
            select: {
              id: true,
              smsEnabled: true,
              smsDailyLimit: true,
              quietHoursStart: true,
              quietHoursEnd: true,
              defaultNotificationPrefsJson: true,
            },
          })
        : Promise.resolve(null),
    ]);

    const preferences = resolveUserNotificationPreferences(
      userRecord?.notificationPrefsJson,
      centerRecord?.defaultNotificationPrefsJson
    );
    const quietHours = resolveUserQuietHours(
      userRecord?.notificationPrefsJson,
      centerRecord?.quietHoursStart,
      centerRecord?.quietHoursEnd
    );

    const centerDefaults = resolveUserNotificationPreferences(
      null,
      centerRecord?.defaultNotificationPrefsJson
    );

    return noStoreJson({
      preferences,
      quietHours,
      centerSettings: {
        smsEnabled: centerRecord?.smsEnabled ?? false,
        smsDailyLimit: centerRecord?.smsDailyLimit ?? 100,
        quietHoursStart: centerRecord?.quietHoursStart ?? 21,
        quietHoursEnd: centerRecord?.quietHoursEnd ?? 8,
        defaultPreferences: centerDefaults,
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return noStoreJson({ error: error.message }, error.status);
    }
    console.error("[GET /api/account/notification-preferences]", error);
    return noStoreJson({ error: "Internal Server Error" }, 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const actor = await resolvePrefsActor(req, true);
    const { centerId, role, session, isPlatformStaff, isReadOnly } = actor;

    if (isReadOnly) {
      return noStoreJson({ error: "Read-only impersonation mode" }, 403);
    }

    const body = await req.json();
    const parsed = updateNotificationPrefsSchema.safeParse(body);
    if (!parsed.success) {
      return noStoreJson(
        { error: "Validation error", details: parsed.error.flatten() },
        400
      );
    }

    const {
      preferences,
      quietHours,
      smsEnabled,
      smsDailyLimit,
      centerDefaultPreferences,
    } = parsed.data;

    const wantsCenterUpdate =
      smsEnabled !== undefined ||
      smsDailyLimit !== undefined ||
      centerDefaultPreferences !== undefined;

    if (wantsCenterUpdate) {
      if (!centerId) {
        return noStoreJson(
          { error: "Bad Request: No active learning center selected" },
          400
        );
      }

      const canManageCenter =
        hasPermission("settings.manage", session.user.platformRole, role) ||
        role === "DIRECTOR" ||
        role === "CENTER_ADMIN" ||
        isPlatformStaff;

      if (!canManageCenter) {
        return noStoreJson(
          {
            error:
              "Forbidden: Only center administration can change center SMS and default notification settings",
          },
          403
        );
      }

      const currentCenter = await db.learningCenter.findUnique({
        where: { id: centerId },
        select: { defaultNotificationPrefsJson: true },
      });

      let nextCenterDefaultsJson = currentCenter?.defaultNotificationPrefsJson;
      if (centerDefaultPreferences) {
        const mergedDefaults = resolveUserNotificationPreferences(
          JSON.stringify(centerDefaultPreferences),
          currentCenter?.defaultNotificationPrefsJson
        );
        nextCenterDefaultsJson = JSON.stringify(mergedDefaults);
      }

      await db.learningCenter.update({
        where: { id: centerId },
        data: {
          ...(smsEnabled !== undefined ? { smsEnabled } : {}),
          ...(smsDailyLimit !== undefined ? { smsDailyLimit } : {}),
          ...(nextCenterDefaultsJson !== undefined
            ? { defaultNotificationPrefsJson: nextCenterDefaultsJson }
            : {}),
        },
      });

      await logAuditEvent({
        centerId,
        actorUserId: session.user.id,
        action: "CENTER_NOTIFICATION_SETTINGS_UPDATED",
        resource: "LearningCenter",
        resourceId: centerId,
        details: {
          smsEnabled,
          smsDailyLimit,
          hasCenterDefaultPreferences: Boolean(centerDefaultPreferences),
        },
      });
    }

    let updatedUserPrefs: NotificationPreferences | null = null;
    if (preferences || quietHours) {
      const [userRecord, centerRecord] = await Promise.all([
        db.platformUser.findUnique({
          where: { id: session.user.id },
          select: { notificationPrefsJson: true },
        }),
        centerId
          ? db.learningCenter.findUnique({
              where: { id: centerId },
              select: {
                defaultNotificationPrefsJson: true,
                quietHoursStart: true,
                quietHoursEnd: true,
              },
            })
          : Promise.resolve(null),
      ]);

      const currentResolved = resolveUserNotificationPreferences(
        userRecord?.notificationPrefsJson,
        centerRecord?.defaultNotificationPrefsJson
      );
      const currentQuietHours = resolveUserQuietHours(
        userRecord?.notificationPrefsJson,
        centerRecord?.quietHoursStart,
        centerRecord?.quietHoursEnd
      );

      const nextPrefs: NotificationPreferences = {
        attendance:
          (preferences?.attendance as NotificationChannelType[]) ??
          currentResolved.attendance,
        grades:
          (preferences?.grades as NotificationChannelType[]) ??
          currentResolved.grades,
        homework:
          (preferences?.homework as NotificationChannelType[]) ??
          currentResolved.homework,
        payments:
          (preferences?.payments as NotificationChannelType[]) ??
          currentResolved.payments,
        announcements:
          (preferences?.announcements as NotificationChannelType[]) ??
          currentResolved.announcements,
      };
      const nextQuietHours = quietHours ?? currentQuietHours;

      await db.platformUser.update({
        where: { id: session.user.id },
        data: {
          notificationPrefsJson: serializeNotificationPrefsJson(nextPrefs, nextQuietHours),
        },
      });

      updatedUserPrefs = nextPrefs;

      await logAuditEvent({
        ...(centerId ? { centerId } : {}),
        actorUserId: session.user.id,
        action: "USER_NOTIFICATION_PREFS_UPDATED",
        resource: "PlatformUser",
        resourceId: session.user.id,
        details: {
          ...nextPrefs,
          quietHours: nextQuietHours,
        },
      });
    }

    const [finalCenter, finalUser] = await Promise.all([
      centerId
        ? db.learningCenter.findUnique({
            where: { id: centerId },
            select: {
              smsEnabled: true,
              smsDailyLimit: true,
              quietHoursStart: true,
              quietHoursEnd: true,
              defaultNotificationPrefsJson: true,
            },
          })
        : Promise.resolve(null),
      db.platformUser.findUnique({
        where: { id: session.user.id },
        select: { notificationPrefsJson: true },
      }),
    ]);

    return noStoreJson({
      success: true,
      preferences:
        updatedUserPrefs ||
        resolveUserNotificationPreferences(
          finalUser?.notificationPrefsJson,
          finalCenter?.defaultNotificationPrefsJson
        ),
      quietHours: resolveUserQuietHours(
        finalUser?.notificationPrefsJson,
        finalCenter?.quietHoursStart,
        finalCenter?.quietHoursEnd
      ),
      centerSettings: {
        smsEnabled: finalCenter?.smsEnabled ?? false,
        smsDailyLimit: finalCenter?.smsDailyLimit ?? 100,
        quietHoursStart: finalCenter?.quietHoursStart ?? 21,
        quietHoursEnd: finalCenter?.quietHoursEnd ?? 8,
        defaultPreferences: resolveUserNotificationPreferences(
          null,
          finalCenter?.defaultNotificationPrefsJson
        ),
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return noStoreJson({ error: error.message }, error.status);
    }
    console.error("[PATCH /api/account/notification-preferences]", error);
    return noStoreJson({ error: "Internal Server Error" }, 500);
  }
}
