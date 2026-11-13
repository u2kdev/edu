"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sliders,
  Shield,
  Clock,
  Phone,
  Mail,
  Send,
  AlertTriangle,
  CheckCircle2,
  Save,
  Globe,
  RefreshCw,
} from "lucide-react";

export default function PlatformSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Settings form state
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
        setSuccess("Настройки платформы успешно сохранены");
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Глобальные настройки платформы
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Управление льготным периодом, триалом, контактами и режимом обслуживания
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/platform-admin/seo"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            <Globe className="w-4 h-4 text-zinc-400" />
            SEO настройки &rarr;
          </Link>
          <button
            onClick={fetchSettings}
            disabled={loading}
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
            title="Обновить"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          {success}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500">Загрузка настроек...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Billing & Trials */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Тарифные политики и пробный период
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Срок бесплатного триала по умолчанию (в днях) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={90}
                  value={defaultTrialDays}
                  onChange={(e) => setDefaultTrialDays(parseInt(e.target.value, 10) || 14)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  Период пробного доступа, назначаемый новым центрам при регистрации
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Льготный период ожидания оплаты (Grace Period в днях) *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={30}
                  value={gracePeriodDays}
                  onChange={(e) => setGracePeriodDays(parseInt(e.target.value, 10) || 3)}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-zinc-400 mt-1">
                  Дни после окончания подписки, в течение которых центр остаётся активным со статусом OVERDUE
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Support Contacts */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-600" />
              Контакты службы поддержки платформы
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email поддержки
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="support@e-darschi.uz"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Телефон горячей линии
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={supportPhone}
                    onChange={(e) => setSupportPhone(e.target.value)}
                    placeholder="+998 71 200 00 00"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Telegram канал/бот
                </label>
                <div className="relative">
                  <Send className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={supportTelegram}
                    onChange={(e) => setSupportTelegram(e.target.value)}
                    placeholder="@edarschi_support"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Global Maintenance Mode */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-rose-600" />
                  Глобальный режим обслуживания (Maintenance Mode)
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  При включении все пользователи видят баннер технических работ, а модифицирующие операции блокируются
                </p>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
              </label>
            </div>

            {maintenanceMode && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-2">
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 block">
                  Текст баннера технических работ для пользователей:
                </span>
                <textarea
                  rows={2}
                  value={maintenanceBannerText}
                  onChange={(e) => setMaintenanceBannerText(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-rose-200 dark:border-rose-900 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Сохранение..." : "Сохранить все настройки"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
