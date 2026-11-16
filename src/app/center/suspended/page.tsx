import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
// Reason: Exception: Suspended status screen must read center metadata even when center is blocked.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getPlatformSetting } from "@/lib/platform-settings";
import { formatDateLocalized } from "@/i18n";
import LogoutButton from "@/components/LogoutButton";
import Link from "next/link";
import { Calendar, Mail, Phone, Send, HelpCircle, Clock, ShieldAlert } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

  const statusLabels: Record<
    string,
    { label: string; desc: string; borderClass: string; badgeVariant: BadgeVariant }
  > = {
    BLOCKED: {
      label: "Центр заблокирован платформой",
      desc: "Администрация платформы ограничила доступ к учебному центру.",
      borderClass: "border-destructive/40",
      badgeVariant: "destructive",
    },
    CANCELLED: {
      label: "Договор или подписка аннулированы",
      desc: "Обслуживание центра прекращено по решению владельца или платформы.",
      borderClass: "border-destructive/40",
      badgeVariant: "destructive",
    },
    OVERDUE: {
      label: "Подписка просрочена",
      desc: "Истёк оплаченный период тарифа. Для восстановления полного доступа необходимо продлить подписку.",
      borderClass: "border-warning/40",
      badgeVariant: "warning",
    },
    PAUSED: {
      label: "Центр временно приостановлен",
      desc: "Работа учебного центра поставлена на паузу.",
      borderClass: "border-warning/40",
      badgeVariant: "warning",
    },
  };

  const statusInfo = statusLabels[center.status] || {
    label: `Статус: ${center.status}`,
    desc: "Доступ к центру временно ограничен.",
    borderClass: "border-border",
    badgeVariant: "neutral" as BadgeVariant,
  };

  const reason =
    center.suspensionReason || center.cancelledReason || "Причина не указана администрацией.";
  const expirationDate = latestSub
    ? latestSub.trialEndsAt && latestSub.status === "TRIAL"
      ? latestSub.trialEndsAt
      : latestSub.currentPeriodEndsAt
    : null;

  const isDirector = session.activeCenterRole === "DIRECTOR";
  const allowSupportTickets = ["OVERDUE", "PAUSED"].includes(center.status) || isDirector;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className={`w-full max-w-2xl ${statusInfo.borderClass}`}>
        <CardContent className="space-y-6 p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-destructive/30 bg-destructive-subtle text-destructive">
              <ShieldAlert className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <Badge variant={statusInfo.badgeVariant}>{center.status}</Badge>
              <h1 className="mt-1.5 text-xl font-semibold text-foreground">{statusInfo.label}</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">{center.name}</p>
            </div>
          </div>

          {/* Reason Block */}
          <div className="space-y-1.5 rounded-lg border border-border bg-muted/50 p-4">
            <div className="text-xs font-medium text-muted-foreground">Причина ограничения</div>
            <p className="text-sm text-foreground">{reason}</p>
          </div>

          {/* Subscription Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs">
              <div className="mb-1 flex items-center gap-2 font-medium text-muted-foreground">
                <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Срок действия тарифа</span>
              </div>
              <div className="text-sm font-semibold text-foreground tabular-nums">
                {expirationDate ? formatDateLocalized(expirationDate, locale) : "Не установлен"}
              </div>
              {latestSub?.plan && (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Тариф: {latestSub.plan.name}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs">
              <div className="mb-1 flex items-center gap-2 font-medium text-muted-foreground">
                <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
                <span>Режим доступа</span>
              </div>
              <div className="text-sm font-semibold text-warning">
                {["OVERDUE", "PAUSED"].includes(center.status) && isDirector
                  ? "Режим только чтение"
                  : "Полная блокировка"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {["OVERDUE", "PAUSED"].includes(center.status) && isDirector
                  ? "Директору доступен просмотр данных и поддержка"
                  : "Операции с центром приостановлены"}
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
            <div className="text-xs font-medium text-muted-foreground">
              Контакты службы поддержки платформы
            </div>
            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
              <div className="flex items-center gap-2 text-foreground">
                <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <a href={`mailto:${supportContacts.email}`} className="truncate hover:underline">
                  {supportContacts.email}
                </a>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Phone className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                <a href={`tel:${supportContacts.phone}`} className="truncate hover:underline">
                  {supportContacts.phone}
                </a>
              </div>
              <div className="flex items-center gap-2 text-foreground">
                <Send className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                <span className="truncate">{supportContacts.telegram}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
            <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row">
              {allowSupportTickets ? (
                <Link href="/center/support" className="w-full sm:w-auto">
                  <Button type="button" size="sm" className="w-full sm:w-auto">
                    <HelpCircle className="h-4 w-4" aria-hidden="true" />
                    <span>Написать в поддержку</span>
                  </Button>
                </Link>
              ) : (
                <a
                  href={`mailto:${supportContacts.email}?subject=Разблокировка центра ${center.name}`}
                  className="w-full sm:w-auto"
                >
                  <Button type="button" size="sm" className="w-full sm:w-auto">
                    <HelpCircle className="h-4 w-4" aria-hidden="true" />
                    <span>Написать в поддержку</span>
                  </Button>
                </a>
              )}

              {["OVERDUE", "PAUSED"].includes(center.status) && isDirector && (
                <Link href="/center" className="w-full sm:w-auto">
                  <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
                    Перейти в панель (чтение)
                  </Button>
                </Link>
              )}
            </div>

            <div className="flex w-full justify-end sm:w-auto">
              <LogoutButton />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
