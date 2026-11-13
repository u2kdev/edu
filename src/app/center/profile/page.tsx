import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { User, Mail, Phone, Calendar, ShieldCheck, CreditCard } from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";
import { resolveUserNotificationPreferences } from "@/lib/notifications";
import CenterProfileEditor from "@/components/profile/CenterProfileEditor";

export default async function CenterProfilePage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = tenantCtx.center.id;
  const locale = session.user.preferredLanguage;
  const activeRole = tenantCtx.role || "";

  const [user, centerRecord, membership] = await Promise.all([
    tenantCtx.getTenantDb().platformUser.findUnique({
      where: { id: session.user.id },
    }),
    tenantCtx.getTenantDb().learningCenter.findUnique({
      where: { id: centerId },
      select: {
        smsEnabled: true,
        smsDailyLimit: true,
        defaultNotificationPrefsJson: true,
      },
    }),
    tenantCtx.getTenantDb().centerMembership.findFirst({
      where: { userId: session.user.id, centerId },
      include: {
        center: true,
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
    }),
  ]);

  if (!user) redirect("/login");

  const canEditFullName =
    activeRole === "DIRECTOR" ||
    activeRole === "CENTER_ADMIN" ||
    tenantCtx.isPlatformStaff;

  const canManageCenter =
    activeRole === "DIRECTOR" ||
    activeRole === "CENTER_ADMIN" ||
    tenantCtx.isPlatformStaff;

  const resolvedPrefs = resolveUserNotificationPreferences(
    user.notificationPrefsJson,
    centerRecord?.defaultNotificationPrefsJson
  );

  const formattedLang =
    String(user.preferredLanguage) === "uz_Latn"
      ? "uz-Latn"
      : String(user.preferredLanguage) === "uz_Cyrl"
      ? "uz-Cyrl"
      : "ru";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Мой профиль</h2>
        <p className="text-sm text-slate-400 mt-1">
          Личная информация, контактные данные и настройки уведомлений
        </p>
      </div>

      <div className="glass-panel p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-8 items-start">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt={user.fullName}
            className="w-24 h-24 rounded-full object-cover border-4 border-brand-500/40 shrink-0"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-brand-500/20 border-4 border-brand-500/40 flex items-center justify-center text-brand-400 shrink-0">
            <User className="w-12 h-12" />
          </div>
        )}

        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-2xl font-bold text-white">{user.fullName}</h3>
            <p className="text-brand-400 font-medium">Роль: {activeRole}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-slate-300">
              <Mail className="w-5 h-5 text-slate-500" />
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Phone className="w-5 h-5 text-slate-500" />
              <span>{user.phone || "Телефон не указан"}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Calendar className="w-5 h-5 text-slate-500" />
              <span>
                {t(locale, "profile.joinedAt")}:{" "}
                {formatDateLocalized(user.createdAt, locale)}
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <ShieldCheck className="w-5 h-5 text-slate-500" />
              <span>
                2FA: {user.twoFactorEnabled ? "Включена" : "Отключена"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Profile & Notification Settings Editor */}
      <CenterProfileEditor
        initialProfile={{
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          username: user.username,
          avatarUrl: user.avatarUrl,
          preferredLanguage: formattedLang,
          role: activeRole,
          canEditFullName,
        }}
        initialPreferences={resolvedPrefs}
        initialCenterSettings={{
          smsEnabled: centerRecord?.smsEnabled ?? false,
          smsDailyLimit: centerRecord?.smsDailyLimit ?? 100,
          canManageCenter,
        }}
      />

      {activeRole === "STUDENT" && membership && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-400" />
            Мои группы
          </h3>
          {membership.enrollments.length === 0 ? (
            <p className="text-slate-400 text-sm">
              Вы пока не записаны ни в одну группу.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {membership.enrollments.map((en) => (
                <div
                  key={en.id}
                  className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 flex justify-between items-center"
                >
                  <span className="font-semibold text-white">
                    {en.group.name}
                  </span>
                  <span className="text-xs px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg font-medium">
                    {en.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeRole === "PARENT" && membership && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-brand-400" />
            Привязанные дети (ученики)
          </h3>
          {membership.parentLinksAsParent.length === 0 ? (
            <p className="text-slate-400 text-sm">
              Дети не привязаны к вашему аккаунту.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {membership.parentLinksAsParent.map((pl) => (
                <div
                  key={pl.id}
                  className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 flex justify-between items-center"
                >
                  <span className="font-semibold text-white">
                    {pl.student.user.fullName}
                  </span>
                  <span className="text-xs px-2.5 py-1 bg-brand-500/10 text-brand-400 rounded-lg font-medium">
                    Ученик
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Security Actions */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-400" />
            Безопасность аккаунта
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Вы можете изменить пароль или завершить все активные сеансы на других устройствах.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href="/account/change-password"
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition-all border border-slate-700"
          >
            Сменить пароль
          </a>
          <a
            href="/account/security"
            className="px-4 py-2.5 bg-brand-600/20 hover:bg-brand-600/30 text-brand-300 font-semibold rounded-xl text-xs transition-all border border-brand-500/30"
          >
            Управление 2FA и Сессиями
          </a>
        </div>
      </div>
    </div>
  );
}
