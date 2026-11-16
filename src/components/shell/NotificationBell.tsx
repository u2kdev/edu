"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t, formatDateLocalized } from "@/i18n";

interface FeedNotification {
  id: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  bodyParams: unknown;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  initialUnreadCount: number;
  notificationsHref: string;
  locale: string;
}

const ACTION_URL_BY_TYPE: Record<string, string> = {
  NEW_HOMEWORK: "/center/homework",
  GRADE_POSTED: "/center/grades",
  ATTENDANCE_ABSENT: "/center/attendance",
  ATTENDANCE_LATE: "/center/attendance",
  PAYMENT_DUE: "/center/payments",
  PAYMENT_OVERDUE: "/center/payments",
  PAYMENT_CONFIRMED: "/center/payments",
  SCHEDULE_CHANGE: "/center/schedule",
  ANNOUNCEMENT: "/center/announcements",
};

function parseParams(raw: unknown): Record<string, string | number> | undefined {
  if (!raw) return undefined;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, string | number>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, string | number>;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function NotificationBell({
  initialUnreadCount,
  notificationsHref,
  locale,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState<FeedNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?page=1&pageSize=6");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.notifications)) {
        setItems(data.notifications);
      }
      if (typeof data.unreadCount === "number") {
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // Keep badge count cleanly if network fails
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      void loadPreview();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {
      // ignore transient errors
    }
  };

  const handleItemClick = async (item: FeedNotification) => {
    if (!item.isRead) {
      try {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId: item.id }),
        });
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // ignore
      }
    }
    setOpen(false);
    const targetUrl = ACTION_URL_BY_TYPE[item.type] || notificationsHref;
    router.push(targetUrl);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-lg border border-transparent hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={t(locale, "nav.notifications")}
          aria-label={t(locale, "nav.notifications")}
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-xs leading-[18px] font-semibold text-primary-foreground flex items-center justify-center tabular-nums">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0 overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-foreground">
            {t(locale, "shell.notificationsTitle")}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t(locale, "notifications.markAllRead")}</span>
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground text-center">
              {t(locale, "common.loading")}
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground text-center">
              {t(locale, "shell.notificationsEmpty")}
            </div>
          ) : (
            items.map((item) => {
              const params = parseParams(item.bodyParams);
              const translatedTitle = t(locale, item.titleKey, params);
              const translatedBody = t(locale, item.bodyKey, params);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-muted/60 transition-colors flex items-start gap-2.5 focus-visible:outline-none focus-visible:bg-muted"
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      item.isRead ? "bg-muted-foreground/30" : "bg-primary"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="flex-1 min-w-0 block">
                    <span className="block text-xs font-semibold text-foreground truncate">
                      {translatedTitle}
                    </span>
                    <span className="block text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {translatedBody}
                    </span>
                    <span className="block text-xs text-muted-foreground/80 mt-1">
                      {formatDateLocalized(item.createdAt, locale)}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="p-2 border-t border-border bg-muted/40">
          <Link
            href={notificationsHref}
            onClick={() => setOpen(false)}
            className="flex items-center justify-center min-h-[36px] rounded-md text-xs font-medium text-primary hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t(locale, "shell.viewAllNotifications")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
