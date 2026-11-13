import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
// Reason: Exception: Suspended status screen must read center metadata even when center is blocked.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getPlatformSetting } from "@/lib/platform-settings";
import { formatDateLocalized } from "@/i18n";
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";
import {
  AlertOctagon,
  Calendar,
  Mail,
  Phone,
  Send,
  HelpCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";

export default async function CenterSuspendedPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/login");

  const center = await db.learningCenter.findUnique({
    where: { id: centerId },
    include: {
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { plan: true },
      },
    },
  });

  if (!center) redirect("/login");

  const supportContacts = await getPlatformSetting("support.contacts");
  const latestSub = center.subscriptions[0];
  const locale = session.user.preferredLanguage || "ru";

  const statusLabels: Record<string, { label: string; desc: string; color: string; badge: string }> = {
    BLOCKED: {
      label: "Центр заблокирован платформой",
      desc: "Администрация платформы ограничила доступ к учебному центру.",
      color: "border-rose-500/40 bg-rose-500/5",
      badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
    CANCELLED: {
      label: "Договор или подписка аннулированы",
      desc: "Обслуживание центра прекращено по решению владельца или платформы.",
      color: "border-rose-500/40 bg-rose-500/5",
      badge: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    },
    OVERDUE: {
      label: "Подписка просрочена",
      desc: "Истёк оплаченный период тарифа. Для восстановления полного доступа необходимо продлить подписку.",
      color: "border-amber-500/40 bg-amber-500/5",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    PAUSED: {
      label: "Центр временно приостановлен",
      desc: "Работа учебного центра поставлена на паузу.",
      color: "border-amber-500/40 bg-amber-500/5",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
  };

  const statusInfo = statusLabels[center.status] || {
    label: `Статус: ${center.status}`,
    desc: "Доступ к центру временно ограничен.",
    color: "border-slate-800 bg-slate-900/40",
    badge: "bg-slate-800 text-slate-300 border-slate-700",
  };

  const reason = center.suspensionReason || center.cancelledReason || "Причина не указана администрацией.";
  const expirationDate = latestSub
    ? latestSub.trialEndsAt && latestSub.status === "TRIAL"
      ? latestSub.trialEndsAt
      : latestSub.currentPeriodEndsAt
    : null;

  const isDirector = session.activeCenterRole === "DIRECTOR";
  const allowSupportTickets = ["OVERDUE", "PAUSED"].includes(center.status) || isDirector;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className={`max-w-2xl w-full glass-panel rounded-3xl border p-8 space-y-6 ${statusInfo.color}`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.badge}`}>
                {center.status}
              </span>
              <h1 className="text-2xl font-bold text-white mt-1">{statusInfo.label}</h1>
              <p className="text-xs text-slate-400 mt-0.5">{center.name}</p>
            </div>
          </div>
        </div>

        {/* Reason Block */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1.5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Причина ограничения</div>
          <p className="text-sm text-slate-200">{reason}</p>
        </div>

        {/* Subscription Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-400 mb-1 font-semibold uppercase tracking-wider">
              <Calendar className="w-4 h-4 text-brand-400" />
              Срок действия тарифа
            </div>
            <div className="text-sm font-bold text-white">
              {expirationDate ? formatDateLocalized(expirationDate, locale) : "Не установлен"}
            </div>
            {latestSub?.plan && (
              <div className="text-slate-400 text-[11px] mt-0.5">Тариф: {latestSub.plan.name}</div>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-400 mb-1 font-semibold uppercase tracking-wider">
              <Clock className="w-4 h-4 text-amber-400" />
              Режим доступа
            </div>
            <div className="text-sm font-bold text-amber-300">
              {["OVERDUE", "PAUSED"].includes(center.status) && isDirector
                ? "Режим только чтение"
                : "Полная блокировка"}
            </div>
            <div className="text-slate-400 text-[11px] mt-0.5">
              {["OVERDUE", "PAUSED"].includes(center.status) && isDirector
                ? "Директору доступен просмотр данных и поддержка"
                : "Операции с центром приостановлены"}
            </div>
          </div>
        </div>

        {/* Contacts */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Контакты службы поддержки платформы
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Mail className="w-4 h-4 text-brand-400 shrink-0" />
              <a href={`mailto:${supportContacts.email}`} className="hover:text-white truncate">
                {supportContacts.email}
              </a>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              <a href={`tel:${supportContacts.phone}`} className="hover:text-white truncate">
                {supportContacts.phone}
              </a>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Send className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="truncate">{supportContacts.telegram}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {allowSupportTickets ? (
              <Link
                href="/center/support"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
              >
                <HelpCircle className="w-4 h-4" />
                Написать в поддержку
              </Link>
            ) : (
              <a
                href={`mailto:${supportContacts.email}?subject=Разблокировка центра ${center.name}`}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs transition-colors flex items-center justify-center gap-2"
              >
                <HelpCircle className="w-4 h-4" />
                Написать в поддержку
              </a>
            )}

            {["OVERDUE", "PAUSED"].includes(center.status) && isDirector && (
              <Link
                href="/center"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors text-center"
              >
                Перейти в панель (чтение)
              </Link>
            )}
          </div>

          <div className="w-full sm:w-auto flex justify-end">
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
