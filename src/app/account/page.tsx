export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";
// Reason: Exception: Account settings page reads authenticated user profile and optional active center settings across scopes.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import {
  resolveUserNotificationPreferences,
  resolveUserQuietHours,
} from "@/lib/notifications";
import { AccountSettingsTabs } from "@/components/account/AccountSettingsTabs";

export default async function UnifiedAccountPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  if (session.user.mustChangePassword) {
    redirect("/account/change-password");
  }

  const locale = session.user.preferredLanguage || "ru";
  const centerId = session.activeCenterId;
  const activeRole =
    session.activeCenterRole ||
    (session.user.platformRole !== "NONE" ? session.user.platformRole : "USER");

  const [user, centerRecord, membership] = await Promise.all([
    db.platformUser.findUnique({
      where: { id: session.user.id },
    }),
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
    centerId
      ? db.centerMembership.findFirst({
          where: { userId: session.user.id, centerId },
          include: {
            enrollments: {
              where: { status: "ACTIVE" },
              include: { group: { select: { name: true } } },
            },
            parentLinksAsParent: {
              where: { status: "CONFIRMED" },
              include: {
                student: { include: { user: { select: { fullName: true } } } },
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  if (!user) redirect("/login");

  const isPlatformStaff = [
    "DEVELOPER",
    "SUPERADMIN",
    "PLATFORM_ADMIN",
    "FULL_ACCESS",
    "SEO_ADMIN",
  ].includes(session.user.platformRole);

  const canEditFullName =
    activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN" || isPlatformStaff;

  const canManageCenter =
    Boolean(centerId) &&
    (activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN" || isPlatformStaff);

  const resolvedPrefs = resolveUserNotificationPreferences(
    user.notificationPrefsJson,
    centerRecord?.defaultNotificationPrefsJson
  );
  const resolvedQuietHours = resolveUserQuietHours(
    user.notificationPrefsJson,
    centerRecord?.quietHoursStart,
    centerRecord?.quietHoursEnd
  );

  const formattedLang =
    String(user.preferredLanguage) === "uz_Latn"
      ? "uz-Latn"
      : String(user.preferredLanguage) === "uz_Cyrl"
        ? "uz-Cyrl"
        : "ru";

  const isReadOnly =
    Boolean(session.isReadOnly) ||
    Boolean(session.impersonatorUserId && !session.allowWrite) ||
    session.user.platformRole === "PLATFORM_SUPPORT";

  return (
    <Suspense fallback={null}>
      <AccountSettingsTabs
        profile={{
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          username: user.username,
          avatarUrl: user.avatarUrl,
          preferredLanguage: formattedLang,
          createdAt: user.createdAt.toISOString(),
          role: activeRole,
          canEditFullName,
          twoFactorEnabled: Boolean(user.twoFactorEnabled),
        }}
        preferences={resolvedPrefs}
        quietHours={resolvedQuietHours}
        centerSettings={{
          hasCenter: Boolean(centerId),
          smsEnabled: centerRecord?.smsEnabled ?? false,
          smsDailyLimit: centerRecord?.smsDailyLimit ?? 100,
          canManageCenter,
        }}
        studentEnrollments={(membership?.enrollments || []).map((en) => ({
          id: en.id,
          status: en.status,
          groupName: en.group.name,
        }))}
        parentChildren={(membership?.parentLinksAsParent || []).map((pl) => ({
          id: pl.id,
          fullName: pl.student.user.fullName,
        }))}
        notificationsHref={centerId ? "/center/notifications" : undefined}
        isReadOnly={isReadOnly}
        locale={locale}
      />
    </Suspense>
  );
}
