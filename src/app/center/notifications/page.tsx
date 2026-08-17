"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2, AlertCircle, Clock, BookOpen, GraduationCap, Building2, ExternalLink } from "lucide-react";
import { formatDateLocalized } from "@/i18n";

interface AppNotification {
  id: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  bodyParams: any;
  channel: string;
  isRead: boolean;
  createdAt: string;
  centerId: string | null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/notifications?unreadOnly=${unreadOnly}`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [unreadOnly]);

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
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
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "NEW_HOMEWORK": return <BookOpen className="w-5 h-5 text-brand-400" />;
      case "GRADE_POSTED": return <GraduationCap className="w-5 h-5 text-emerald-400" />;
      case "SCHEDULE_CHANGE":
      case "SCHEDULE_CANCELLED": return <Clock className="w-5 h-5 text-amber-400" />;
      case "ATTENDANCE_ABSENT":
      case "ATTENDANCE_LATE": return <AlertCircle className="w-5 h-5 text-red-400" />;
      default: return <Bell className="w-5 h-5 text-blue-400" />;
    }
  };

  const translateTitle = (key: string) => {
    const dict: any = {
      "notifications.newHomework": "Новое домашнее задание",
      "notifications.gradePosted": "Оценка выставлена",
      "notifications.scheduleChanged": "Изменение в расписании",
      "notifications.scheduleCancelled": "Урок отменен",
      "notification.attendanceAbsent.title": "Пропуск занятия",
      "notification.attendanceLate.title": "Опоздание на занятие",
    };
    return dict[key] || key;
  };

  const translateBody = (key: string, params: any) => {
    const p = typeof params === "string" ? JSON.parse(params) : params || {};
    const dict: any = {
      "notifications.newHomeworkBody": `Вам задали домашнее задание: ${p.title}`,
      "notifications.gradePostedBody": `Оценка: ${p.value} / ${p.maxValue}`,
      "notifications.scheduleBody": `Изменения для группы: ${p.groupName}`,
      "notification.attendanceAbsent.body": `Ученик ${p.studentName || ""} отсутствовал на занятии.`,
      "notification.attendanceLate.body": `Ученик ${p.studentName || ""} опоздал на занятие.`,
    };
    return dict[key] || key;
  };

  const getLinkForType = (type: string) => {
    switch (type) {
      case "NEW_HOMEWORK": return "/center/homework";
      case "GRADE_POSTED": return "/center/grades";
      case "SCHEDULE_CHANGE": 
      case "SCHEDULE_CANCELLED": return "/center/schedule";
      case "ATTENDANCE_ABSENT":
      case "ATTENDANCE_LATE": return "/center/attendance";
      default: return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bell className="w-6 h-6 text-brand-400" />
            Уведомления
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-400 text-xs font-bold">
                {unreadCount} новых
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-400 mt-1">Центр уведомлений</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              unreadOnly 
                ? "bg-slate-800 text-white border border-slate-700" 
                : "bg-slate-900/50 text-slate-400 border border-slate-800 hover:bg-slate-800"
            }`}
          >
            Только непрочитанные
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Прочитать все
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 glass-panel rounded-2xl animate-pulse border border-slate-800">
            Загрузка уведомлений...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-400 bg-red-950/20 rounded-2xl border border-red-500/20">
            <AlertCircle className="w-8 h-8 mx-auto mb-3" />
            <p>{error}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center glass-panel rounded-2xl border border-slate-800">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-bold text-white">Нет новых уведомлений</h3>
            <p className="text-slate-400 mt-1">
              {unreadOnly ? "У вас нет непрочитанных сообщений." : "Здесь будут отображаться важные события."}
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`relative p-5 rounded-2xl border transition-all flex gap-4 ${
                notif.isRead 
                  ? "bg-slate-900/40 border-slate-800/50" 
                  : "bg-slate-900 border-brand-500/30 shadow-lg shadow-brand-500/5"
              }`}
            >
              {!notif.isRead && (
                <div className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-brand-500" />
              )}
              
              <div className={`w-12 h-12 rounded-xl shrink-0 flex items-center justify-center ${
                notif.isRead ? "bg-slate-800/50" : "bg-slate-800 border border-slate-700"
              }`}>
                {getIconForType(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <h4 className={`font-bold text-base truncate ${notif.isRead ? "text-slate-300" : "text-white"}`}>
                    {translateTitle(notif.titleKey)}
                  </h4>
                  <span className="text-xs text-slate-500 shrink-0 mt-0.5">
                    {formatDateLocalized(new Date(notif.createdAt), "ru")}
                  </span>
                </div>
                <p className={`text-sm ${notif.isRead ? "text-slate-500" : "text-slate-300"}`}>
                  {translateBody(notif.bodyKey, notif.bodyParams)}
                </p>

                <div className="flex items-center gap-4 mt-3">
                  {!notif.isRead && (
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                    >
                      Отметить как прочитанное
                    </button>
                  )}
                  {getLinkForType(notif.type) && (
                    <button
                      onClick={() => {
                        if (!notif.isRead) markAsRead(notif.id);
                        router.push(getLinkForType(notif.type) as string);
                      }}
                      className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1"
                    >
                      <span>Перейти</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
