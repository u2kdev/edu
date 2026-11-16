"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Clock, ExternalLink, MessageSquare, Save } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  NotificationChannelType,
  NotificationEventCategory,
  NotificationPreferences,
  UserQuietHoursConfig,
} from "@/lib/notifications";
import { t } from "@/i18n";

interface NotificationsTabPanelProps {
  initialPreferences: NotificationPreferences;
  initialQuietHours: UserQuietHoursConfig;
  initialCenterSettings: {
    hasCenter: boolean;
    smsEnabled: boolean;
    smsDailyLimit: number;
    canManageCenter: boolean;
  };
  locale: string;
  isReadOnly: boolean;
  notificationsHref?: string;
}

const EVENT_ROWS: Array<{ key: NotificationEventCategory; titleKey: string }> = [
  { key: "attendance", titleKey: "account.eventAttendance" },
  { key: "grades", titleKey: "account.eventGrades" },
  { key: "homework", titleKey: "account.eventHomework" },
  { key: "payments", titleKey: "account.eventPayments" },
  { key: "announcements", titleKey: "account.eventAnnouncements" },
];

const CHANNELS: Array<{ key: NotificationChannelType; labelKey: string }> = [
  { key: "IN_APP", labelKey: "account.channelInApp" },
  { key: "PUSH", labelKey: "account.channelPush" },
  { key: "EMAIL", labelKey: "account.channelEmail" },
  { key: "SMS", labelKey: "account.channelSms" },
  { key: "TELEGRAM", labelKey: "account.channelTelegram" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export function NotificationsTabPanel({
  initialPreferences,
  initialQuietHours,
  initialCenterSettings,
  locale,
  isReadOnly,
  notificationsHref,
}: NotificationsTabPanelProps) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferences>(initialPreferences);
  const [quietHours, setQuietHours] = useState<UserQuietHoursConfig>(initialQuietHours);
  const [smsEnabled, setSmsEnabled] = useState(initialCenterSettings.smsEnabled);
  const [smsDailyLimit, setSmsDailyLimit] = useState(initialCenterSettings.smsDailyLimit);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const toggleChannel = (cat: NotificationEventCategory, ch: NotificationChannelType) => {
    if (isReadOnly) return;
    setPrefs((prev) => {
      const current = prev[cat] || [];
      const exists = current.includes(ch);
      return {
        ...prev,
        [cat]: exists ? current.filter((c) => c !== ch) : [...current, ch],
      };
    });
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/account/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: prefs,
          quietHours,
          ...(initialCenterSettings.hasCenter && initialCenterSettings.canManageCenter
            ? { smsEnabled, smsDailyLimit: Number(smsDailyLimit) || 0 }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t(locale, "common.error"));
      setNotice({ type: "success", text: t(locale, "account.notificationsSaved") });
      router.refresh();
    } catch (err) {
      setNotice({
        type: "error",
        text: err instanceof Error ? err.message : t(locale, "common.error"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {notice && (
        <Alert variant={notice.type === "success" ? "success" : "destructive"}>
          {notice.text}
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>{t(locale, "account.notificationsMatrixTitle")}</span>
            </CardTitle>
            <CardDescription>{t(locale, "account.notificationsMatrixDesc")}</CardDescription>
          </div>
          {notificationsHref && (
            <Link
              href={notificationsHref}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0"
            >
              <span>{t(locale, "account.openNotificationsHistory")}</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {EVENT_ROWS.map((ev) => {
            const active = prefs[ev.key] || [];
            return (
              <div
                key={ev.key}
                className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <span className="text-sm font-medium text-foreground">
                  {t(locale, ev.titleKey)}
                </span>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS.map((ch) => {
                    const checked = active.includes(ch.key);
                    return (
                      <button
                        key={ch.key}
                        type="button"
                        disabled={isReadOnly}
                        aria-pressed={checked}
                        onClick={() => toggleChannel(ev.key, ch.key)}
                        className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          checked
                            ? "bg-accent border-primary/50 text-accent-foreground"
                            : "bg-background border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t(locale, ch.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>{t(locale, "account.quietHoursTitle")}</span>
            </CardTitle>
            <CardDescription>{t(locale, "account.quietHoursDesc")}</CardDescription>
          </div>
          <Switch
            aria-label={t(locale, "account.quietHoursEnable")}
            checked={quietHours.enabled}
            disabled={isReadOnly}
            onCheckedChange={(checked) =>
              setQuietHours((prev) => ({ ...prev, enabled: checked }))
            }
          />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="qh-start">{t(locale, "account.quietHoursFrom")}</Label>
              <select
                id="qh-start"
                disabled={!quietHours.enabled || isReadOnly}
                value={quietHours.start}
                onChange={(e) =>
                  setQuietHours((prev) => ({ ...prev, start: Number(e.target.value) }))
                }
                className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular-nums"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qh-end">{t(locale, "account.quietHoursTo")}</Label>
              <select
                id="qh-end"
                disabled={!quietHours.enabled || isReadOnly}
                value={quietHours.end}
                onChange={(e) =>
                  setQuietHours((prev) => ({ ...prev, end: Number(e.target.value) }))
                }
                className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular-nums"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {initialCenterSettings.hasCenter && initialCenterSettings.canManageCenter && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>{t(locale, "account.centerSmsTitle")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/40">
              <Label htmlFor="center-sms-enabled">{t(locale, "account.centerSmsEnabled")}</Label>
              <Switch
                id="center-sms-enabled"
                checked={smsEnabled}
                disabled={isReadOnly}
                onCheckedChange={setSmsEnabled}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="center-sms-limit">{t(locale, "account.centerSmsDailyLimit")}</Label>
              <Input
                id="center-sms-limit"
                type="number"
                min={0}
                max={100000}
                disabled={isReadOnly}
                value={smsDailyLimit}
                onChange={(e) => setSmsDailyLimit(Number(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={saving || isReadOnly}
          loading={saving}
          onClick={handleSave}
          className="min-h-[40px]"
        >
          <Save className="w-4 h-4" aria-hidden="true" />
          <span>{t(locale, "account.saveNotifications")}</span>
        </Button>
      </div>
    </div>
  );
}
