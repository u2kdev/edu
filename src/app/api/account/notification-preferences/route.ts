import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError, logAuditEvent } from "@/lib/tenant";
import { isActorImpersonating } from "@/lib/tenant-access";
import { hasPermission } from "@/lib/permissions";
import {
  resolveUserNotificationPreferences,
  NotificationPreferences,
  NotificationChannelType,
} from "@/lib/notifications";
// Reason: Exception: Account self-service operates on platformUser and learningCenter settings scoped by session.user.id and tenantCtx.center.id.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { z } from "zod";

const channelEnum = z.enum(["IN_APP", "EMAIL", "PUSH", "SMS"]);

const preferencesSchema = z.object({
  attendance: z.array(channelEnum).optional(),
  grades: z.array(channelEnum).optional(),
  homework: z.array(channelEnum).optional(),
  payments: z.array(channelEnum).optional(),
  announcements: z.array(channelEnum).optional(),
});

const updateNotificationPrefsSchema = z.object({
  preferences: preferencesSchema.optional(),
  // Center-level settings (DIRECTOR / CENTER_ADMIN only)
  smsEnabled: z.boolean().optional(),
  smsDailyLimit: z.number().int().min(0).max(100000).optional(),
  centerDefaultPreferences: preferencesSchema.optional(),
});

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, session } = tenantCtx;

    const [userRecord, centerRecord] = await Promise.all([
      db.platformUser.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          notificationPrefsJson: true,
        },
      }),
      db.learningCenter.findUnique({
        where: { id: center.id },
        select: {
          id: true,
          smsEnabled: true,
          smsDailyLimit: true,
          defaultNotificationPrefsJson: true,
        },
      }),
    ]);

    const preferences = resolveUserNotificationPreferences(
      userRecord?.notificationPrefsJson,
      centerRecord?.defaultNotificationPrefsJson
    );

    const centerDefaults = resolveUserNotificationPreferences(
      null,
      centerRecord?.defaultNotificationPrefsJson
    );

    return NextResponse.json({
      preferences,
      centerSettings: {
        smsEnabled: centerRecord?.smsEnabled ?? false,
        smsDailyLimit: centerRecord?.smsDailyLimit ?? 100,
        defaultPreferences: centerDefaults,
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/account/notification-preferences]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session } = tenantCtx;

    if (isActorImpersonating(tenantCtx)) {
      return NextResponse.json(
        { error: "Read-only impersonation mode" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateNotificationPrefsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      preferences,
      smsEnabled,
      smsDailyLimit,
      centerDefaultPreferences,
    } = parsed.data;

    const wantsCenterUpdate =
      smsEnabled !== undefined ||
      smsDailyLimit !== undefined ||
      centerDefaultPreferences !== undefined;

    if (wantsCenterUpdate) {
      const canManageCenter =
        hasPermission("settings.manage", session.user.platformRole, role) ||
        role === "DIRECTOR" ||
        role === "CENTER_ADMIN" ||
        tenantCtx.isPlatformStaff;

      if (!canManageCenter) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Only center administration can change center SMS and default notification settings",
          },
          { status: 403 }
        );
      }

      const currentCenter = await db.learningCenter.findUnique({
        where: { id: center.id },
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
        where: { id: center.id },
        data: {
          ...(smsEnabled !== undefined ? { smsEnabled } : {}),
          ...(smsDailyLimit !== undefined ? { smsDailyLimit } : {}),
          ...(nextCenterDefaultsJson !== undefined
            ? { defaultNotificationPrefsJson: nextCenterDefaultsJson }
            : {}),
        },
      });

      await logAuditEvent({
        centerId: center.id,
        actorUserId: session.user.id,
        action: "CENTER_NOTIFICATION_SETTINGS_UPDATED",
        resource: "LearningCenter",
        resourceId: center.id,
        details: {
          smsEnabled,
          smsDailyLimit,
          hasCenterDefaultPreferences: Boolean(centerDefaultPreferences),
        },
      });
    }

    let updatedUserPrefs: NotificationPreferences | null = null;
    if (preferences) {
      const [userRecord, centerRecord] = await Promise.all([
        db.platformUser.findUnique({
          where: { id: session.user.id },
          select: { notificationPrefsJson: true },
        }),
        db.learningCenter.findUnique({
          where: { id: center.id },
          select: { defaultNotificationPrefsJson: true },
        }),
      ]);

      const currentResolved = resolveUserNotificationPreferences(
        userRecord?.notificationPrefsJson,
        centerRecord?.defaultNotificationPrefsJson
      );

      const nextPrefs: NotificationPreferences = {
        attendance:
          (preferences.attendance as NotificationChannelType[]) ??
          currentResolved.attendance,
        grades:
          (preferences.grades as NotificationChannelType[]) ??
          currentResolved.grades,
        homework:
          (preferences.homework as NotificationChannelType[]) ??
          currentResolved.homework,
        payments:
          (preferences.payments as NotificationChannelType[]) ??
          currentResolved.payments,
        announcements:
          (preferences.announcements as NotificationChannelType[]) ??
          currentResolved.announcements,
      };

      await db.platformUser.update({
        where: { id: session.user.id },
        data: {
          notificationPrefsJson: JSON.stringify(nextPrefs),
        },
      });

      updatedUserPrefs = nextPrefs;

      await logAuditEvent({
        centerId: center.id,
        actorUserId: session.user.id,
        action: "USER_NOTIFICATION_PREFS_UPDATED",
        resource: "PlatformUser",
        resourceId: session.user.id,
        details: nextPrefs,
      });
    }

    const finalCenter = await db.learningCenter.findUnique({
      where: { id: center.id },
      select: {
        smsEnabled: true,
        smsDailyLimit: true,
        defaultNotificationPrefsJson: true,
      },
    });
    const finalUser = await db.platformUser.findUnique({
      where: { id: session.user.id },
      select: { notificationPrefsJson: true },
    });

    return NextResponse.json({
      success: true,
      preferences:
        updatedUserPrefs ||
        resolveUserNotificationPreferences(
          finalUser?.notificationPrefsJson,
          finalCenter?.defaultNotificationPrefsJson
        ),
      centerSettings: {
        smsEnabled: finalCenter?.smsEnabled ?? false,
        smsDailyLimit: finalCenter?.smsDailyLimit ?? 100,
        defaultPreferences: resolveUserNotificationPreferences(
          null,
          finalCenter?.defaultNotificationPrefsJson
        ),
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[PATCH /api/account/notification-preferences]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
