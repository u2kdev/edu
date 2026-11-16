"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  Clock,
  BookOpen,
  GraduationCap,
  ExternalLink,
  AlertCircle,
  MailCheck,
} from "lucide-react";
import { formatDateLocalized } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";

const SELECT_CLS =
  "flex h-9 rounded-md border border-input bg-card px-3 py-1.5 text-[13px] text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

interface AppNotification {
  id: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  bodyParams: unknown;
  channel: string;
  isRead: boolean;
  createdAt: string;
  centerId: string | null;
}

interface DeliveryLogItem {
  id: string;
  userId: string | null;
  userName: string | null;
  channel: string;
  type: string;
  eventKey: string | null;
  recipient: string | null;
  subject: string | null;
  status: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  deferredUntil: string | null;
  sentAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<"inbox" | "deliveries">("inbox");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const [deliveries, setDeliveries] = useState<DeliveryLogItem[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveriesForbidden, setDeliveriesForbidden] = useState(false);
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null);
  const [deliveryChannel, setDeliveryChannel] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryTotalPages, setDeliveryTotalPages] = useState(1);

  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/notifications?unreadOnly=${unreadOnly}`);
      if (!res.ok) throw new Error("Не удалось загрузить уведомления");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить уведомления");
    } finally {
      setIsLoading(false);
    }
  }, [unreadOnly]);

  const fetchDeliveries = useCallback(async () => {
    try {
      setDeliveriesLoading(true);
      setDeliveriesForbidden(false);
      setDeliveriesError(null);
      const params = new URLSearchParams({
        page: String(deliveryPage),
        pageSize: "20",
      });
      if (deliveryChannel) params.set("channel", deliveryChannel);
      if (deliveryStatus) params.set("status", deliveryStatus);
      if (deliverySearch.trim()) params.set("search", deliverySearch.trim());

      const res = await fetch(`/api/notifications/deliveries?${params.toString()}`);
      if (res.status === 403) {
        setDeliveriesForbidden(true);
        setDeliveries([]);
        return;
      }
      if (!res.ok) throw new Error("Не удалось загрузить журнал доставки");
      const data = await res.json();
      setDeliveries(data.deliveries || []);
      setDeliveryTotalPages(data.totalPages || 1);
    } catch (err) {
      setDeliveriesError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setDeliveriesLoading(false);
    }
  }, [deliveryChannel, deliveryStatus, deliverySearch, deliveryPage]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (activeTab === "deliveries") {
      void fetchDeliveries();
    }
  }, [activeTab, fetchDeliveries]);

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // Ignore transient read mark failure
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {
      // Ignore transient mark-all failure
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "NEW_HOMEWORK":
        return <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />;
      case "GRADE_POSTED":
        return <GraduationCap className="h-4 w-4 text-success" aria-hidden="true" />;
      case "SCHEDULE_CHANGE":
      case "SCHEDULE_CANCELLED":
        return <Clock className="h-4 w-4 text-warning" aria-hidden="true" />;
      case "ATTENDANCE_ABSENT":
      case "ATTENDANCE_LATE":
        return <AlertCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
      default:
        return <Bell className="h-4 w-4 text-info" aria-hidden="true" />;
    }
  };

  const translateTitle = (key: string) => {
    const dict: Record<string, string> = {
      "notifications.newHomework": "Новое домашнее задание",
      "notifications.gradePosted": "Оценка выставлена",
      "notifications.scheduleChanged": "Изменение в расписании",
      "notifications.scheduleCancelled": "Урок отменен",
      "notification.attendanceAbsent.title": "Пропуск занятия",
      "notification.attendanceLate.title": "Опоздание на занятие",
    };
    return dict[key] || key;
  };

  const translateBody = (key: string, params: unknown) => {
    let p: Record<string, unknown> = {};
    if (typeof params === "string") {
      try {
        p = JSON.parse(params) as Record<string, unknown>;
      } catch {
        p = {};
      }
    } else if (params && typeof params === "object") {
      p = params as Record<string, unknown>;
    }
    const dict: Record<string, string> = {
      "notifications.newHomeworkBody": `Вам задали домашнее задание: ${String(p.title || "")}`,
      "notifications.gradePostedBody": `Оценка: ${String(p.value || "")} / ${String(p.maxValue || "")}`,
      "notifications.scheduleBody": `Изменения для группы: ${String(p.groupName || "")}`,
      "notification.attendanceAbsent.body": `Ученик ${String(p.studentName || "")} отсутствовал на занятии.`,
      "notification.attendanceLate.body": `Ученик ${String(p.studentName || "")} опоздал на занятие.`,
    };
    return dict[key] || key;
  };

  const getLinkForType = (type: string) => {
    switch (type) {
      case "NEW_HOMEWORK":
        return "/center/homework";
      case "GRADE_POSTED":
        return "/center/grades";
      case "SCHEDULE_CHANGE":
      case "SCHEDULE_CANCELLED":
        return "/center/schedule";
      case "ATTENDANCE_ABSENT":
      case "ATTENDANCE_LATE":
        return "/center/attendance";
      default:
        return null;
    }
  };

  const deliveryStatusVariant = (status: string): BadgeVariant => {
    if (status === "SENT") return "success";
    if (status === "DEFERRED") return "warning";
    if (status === "FAILED") return "destructive";
    return "neutral";
  };

  const deliveryColumns = useMemo<DataTableColumn<DeliveryLogItem>[]>(
    () => [
      {
        id: "channel",
        header: "Канал",
        cell: (d) => <span className="text-xs font-semibold text-foreground">{d.channel}</span>,
      },
      {
        id: "recipient",
        header: "Получатель",
        cell: (d) => (
          <div className="text-xs">
            <div className="font-medium text-foreground">{d.userName || "—"}</div>
            {d.recipient && <div className="text-muted-foreground">{d.recipient}</div>}
          </div>
        ),
      },
      {
        id: "subject",
        header: "Тема / Событие",
        cell: (d) => (
          <div className="text-xs">
            <div className="text-foreground">{d.subject || d.type}</div>
            {d.errorMessage && <div className="text-destructive">{d.errorMessage}</div>}
            {d.deferredUntil && d.status === "DEFERRED" && (
              <div className="text-warning tabular-nums">
                До {formatDateLocalized(new Date(d.deferredUntil), "ru")}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: "Статус",
        cell: (d) => <Badge variant={deliveryStatusVariant(d.status)}>{d.status}</Badge>,
      },
      {
        id: "date",
        header: "Дата",
        cell: (d) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateLocalized(new Date(d.sentAt || d.createdAt), "ru")}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Уведомления"
        description="Центр уведомлений и журнал доставки"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && <Badge variant="primary">{unreadCount} новых</Badge>}
            <Button
              type="button"
              variant={unreadOnly ? "primary" : "outline"}
              size="sm"
              onClick={() => setUnreadOnly(!unreadOnly)}
            >
              Только непрочитанные
            </Button>
            {unreadCount > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={markAllAsRead}>
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                <span>Прочитать все</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button
          type="button"
          size="sm"
          variant={activeTab === "inbox" ? "primary" : "outline"}
          onClick={() => setActiveTab("inbox")}
        >
          Мои уведомления ({total})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={activeTab === "deliveries" ? "primary" : "outline"}
          onClick={() => setActiveTab("deliveries")}
        >
          <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Журнал доставки</span>
        </Button>
      </div>

      {activeTab === "deliveries" ? (
        <div className="space-y-4">
          <FilterBar
            search={deliverySearch}
            onSearchChange={(val) => {
              setDeliveryPage(1);
              setDeliverySearch(val);
            }}
            searchPlaceholder="Поиск по получателю или теме..."
            hasActiveFilters={Boolean(deliverySearch || deliveryChannel || deliveryStatus)}
            onReset={() => {
              setDeliveryPage(1);
              setDeliverySearch("");
              setDeliveryChannel("");
              setDeliveryStatus("");
            }}
          >
            <select
              aria-label="Канал"
              value={deliveryChannel}
              onChange={(e) => {
                setDeliveryPage(1);
                setDeliveryChannel(e.target.value);
              }}
              className={SELECT_CLS}
            >
              <option value="">Все каналы</option>
              <option value="TELEGRAM">Telegram</option>
              <option value="SMS">SMS (Eskiz)</option>
              <option value="PUSH">Push (Expo)</option>
              <option value="EMAIL">Email</option>
            </select>

            <select
              aria-label="Статус доставки"
              value={deliveryStatus}
              onChange={(e) => {
                setDeliveryPage(1);
                setDeliveryStatus(e.target.value);
              }}
              className={SELECT_CLS}
            >
              <option value="">Все статусы</option>
              <option value="SENT">SENT</option>
              <option value="DEFERRED">DEFERRED (Тихие часы)</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
              <option value="SKIPPED">SKIPPED</option>
            </select>
          </FilterBar>

          {deliveriesForbidden ? (
            <EmptyState
              icon={<MailCheck className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
              title="Доступ ограничен"
              description="Журнал доставки центра доступен администрации центра (Директор, Администратор, Бухгалтер)."
            />
          ) : (
            <DataTable
              data={deliveries}
              columns={deliveryColumns}
              getRowId={(d) => d.id}
              loading={deliveriesLoading}
              error={deliveriesError}
              onRetry={() => void fetchDeliveries()}
              page={deliveryPage}
              totalPages={deliveryTotalPages}
              onPageChange={setDeliveryPage}
              emptyTitle="Записи доставки по выбранным фильтрам не найдены."
              mobileCardRender={(d) => (
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-foreground">{d.userName || d.channel}</div>
                      <div className="text-muted-foreground">{d.subject || d.type}</div>
                    </div>
                    <Badge variant={deliveryStatusVariant(d.status)}>{d.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-muted-foreground tabular-nums">
                    <span>{d.channel}</span>
                    <span>{formatDateLocalized(new Date(d.sentAt || d.createdAt), "ru")}</span>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
              title="Нет новых уведомлений"
              description={
                unreadOnly
                  ? "У вас нет непрочитанных сообщений."
                  : "Здесь будут отображаться важные события."
              }
            />
          ) : (
            notifications.map((notif) => (
              <Card
                key={notif.id}
                className={notif.isRead ? "opacity-80" : "border-primary/40"}
              >
                <CardContent className="relative flex gap-4 p-4 sm:p-5">
                  {!notif.isRead && (
                    <span
                      className="absolute right-4 top-4 h-2 w-2 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                  )}

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                    {getIconForType(notif.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-4">
                      <h4 className="truncate text-sm font-semibold text-foreground">
                        {translateTitle(notif.titleKey)}
                      </h4>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatDateLocalized(new Date(notif.createdAt), "ru")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {translateBody(notif.bodyKey, notif.bodyParams)}
                    </p>

                    <div className="mt-3 flex items-center gap-4">
                      {!notif.isRead && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notif.id)}
                        >
                          Отметить как прочитанное
                        </Button>
                      )}
                      {getLinkForType(notif.type) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (!notif.isRead) void markAsRead(notif.id);
                            router.push(getLinkForType(notif.type) as string);
                          }}
                        >
                          <span>Перейти</span>
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
