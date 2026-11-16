"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Clock, Globe, Mail, Phone, RefreshCw, Save, Send, Shield } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
} from "@/components/ui";

export default function PlatformSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [gracePeriodDays, setGracePeriodDays] = useState(3);
  const [defaultTrialDays, setDefaultTrialDays] = useState(14);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceBannerText, setMaintenanceBannerText] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [supportTelegram, setSupportTelegram] = useState("");

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        setGracePeriodDays(s["billing.gracePeriodDays"] ?? 3);
        setDefaultTrialDays(s["billing.defaultTrialDays"] ?? 14);
        setMaintenanceMode(Boolean(s["system.maintenanceMode"]));
        setMaintenanceBannerText(
          s["system.maintenanceBannerText"] ||
            "На платформе проводятся плановые технические работы. Приносим извинения за временные неудобства."
        );
        if (s["support.contacts"]) {
          setSupportEmail(s["support.contacts"].email || "");
          setSupportPhone(s["support.contacts"].phone || "");
          setSupportTelegram(s["support.contacts"].telegram || "");
        }
      } else {
        setError(data.error || "Не удалось загрузить настройки платформы");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      "billing.gracePeriodDays": Number(gracePeriodDays),
      "billing.defaultTrialDays": Number(defaultTrialDays),
      "system.maintenanceMode": Boolean(maintenanceMode),
      "system.maintenanceBannerText": maintenanceBannerText.trim(),
      "support.contacts": {
        email: supportEmail.trim(),
        phone: supportPhone.trim(),
        telegram: supportTelegram.trim(),
      },
    };

    try {
      const res = await fetch("/api/platform/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        setError(resData.error || "Ошибка сохранения настроек");
      } else {
        setSuccess("Настройки платформы сохранены");
        setTimeout(() => setSuccess(null), 4000);
      }
    } catch {
      setError("Ошибка сети при сохранении");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Глобальные настройки платформы"
        description="Управление льготным периодом, триалом, контактами и режимом обслуживания"
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/platform-admin/seo">
                <Globe className="h-4 w-4" aria-hidden="true" />
                <span>SEO настройки</span>
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={fetchSettings}
              disabled={loading}
              aria-label="Обновить"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-lg" />
          <Skeleton className="h-36 w-full rounded-lg" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Тарифные политики и пробный период</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Срок бесплатного триала по умолчанию (в днях)"
                htmlFor="settings-trial-days"
                required
                hint="Период пробного доступа для новых центров при регистрации"
              >
                <Input
                  id="settings-trial-days"
                  type="number"
                  required
                  min={1}
                  max={90}
                  value={defaultTrialDays}
                  onChange={(e) => setDefaultTrialDays(parseInt(e.target.value, 10) || 14)}
                />
              </FormField>

              <FormField
                label="Льготный период ожидания оплаты (дней)"
                htmlFor="settings-grace-days"
                required
                hint="Дни после окончания подписки, пока центр остаётся активным со статусом OVERDUE"
              >
                <Input
                  id="settings-grace-days"
                  type="number"
                  required
                  min={0}
                  max={30}
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(parseInt(e.target.value, 10) || 3)}
                />
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Контакты службы поддержки платформы</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Email поддержки" htmlFor="settings-support-email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="settings-support-email"
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="support@e-darschi.uz"
                    className="pl-9"
                  />
                </div>
              </FormField>

              <FormField label="Телефон горячей линии" htmlFor="settings-support-phone">
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="settings-support-phone"
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="+998 71 200 00 00"
                    className="pl-9"
                  />
                </div>
              </FormField>

              <FormField label="Telegram канал/бот" htmlFor="settings-support-tg">
                <div className="relative">
                  <Send className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="settings-support-tg"
                    type="text"
                    value={supportTelegram}
                    onChange={(e) => setSupportTelegram(e.target.value)}
                    placeholder="@edarschi_support"
                    className="pl-9"
                  />
                </div>
              </FormField>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Shield className="h-4 w-4 text-destructive" aria-hidden="true" />
                    <span>Глобальный режим обслуживания</span>
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    При включении пользователи видят баннер технических работ, а изменения блокируются
                  </p>
                </div>

                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    aria-label="Режим обслуживания"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="h-4 w-4 rounded border-input accent-destructive"
                  />
                </label>
              </div>

              {maintenanceMode && (
                <FormField
                  label="Текст баннера технических работ для пользователей"
                  htmlFor="settings-maintenance-text"
                >
                  <Textarea
                    id="settings-maintenance-text"
                    rows={2}
                    value={maintenanceBannerText}
                    onChange={(e) => setMaintenanceBannerText(e.target.value)}
                  />
                </FormField>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" disabled={saving}>
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>{saving ? "Сохранение..." : "Сохранить все настройки"}</span>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
