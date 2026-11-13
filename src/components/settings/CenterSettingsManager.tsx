"use client";

import React, { useState } from "react";
import {
  Settings, Building2, Globe, Shield, Palette, Bell,
  Save, CheckCircle2, AlertTriangle, Calendar, ExternalLink
} from "lucide-react";
import Link from "next/link";

interface CenterData {
  id: string;
  name: string;
  slug: string;
  organizationKind: string;
  centerType: string;
  status: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  inn?: string | null;
  legalName?: string | null;
  contactPerson?: string | null;
  logoUrl?: string | null;
  brandingConfig?: string | null;
  defaultLanguage: "ru" | "uz-Latn" | "uz-Cyrl";
  timeZone: string;
  gradingScale: "PERCENT_100" | "POINTS_5" | "PASS_FAIL";
  createdAt: string;
  subscription?: {
    status: string;
    planName: string;
    currentPeriodEndsAt?: string | null;
    trialEndsAt?: string | null;
  } | null;
}

interface CenterSettingsManagerProps {
  initialCenter: CenterData;
  locale?: string;
  canManage?: boolean;
}

export function CenterSettingsManager({
  initialCenter,
  locale = "ru",
  canManage = true,
}: CenterSettingsManagerProps) {
  const [center, setCenter] = useState<CenterData>(initialCenter);
  const [activeTab, setActiveTab] = useState<"general" | "academic" | "branding" | "notifications">("general");

  // Form fields
  const [name, setName] = useState(center.name || "");
  const [legalName, setLegalName] = useState(center.legalName || "");
  const [inn, setInn] = useState(center.inn || "");
  const [contactPerson, setContactPerson] = useState(center.contactPerson || "");
  const [phone, setPhone] = useState(center.phone || "");
  const [email, setEmail] = useState(center.email || "");
  const [address, setAddress] = useState(center.address || "");

  const [defaultLanguage, setDefaultLanguage] = useState(center.defaultLanguage || "ru");
  const [timeZone, setTimeZone] = useState(center.timeZone || "Asia/Tashkent");
  const [gradingScale, setGradingScale] = useState(center.gradingScale || "PERCENT_100");

  const [logoUrl, setLogoUrl] = useState(center.logoUrl || "");

  // Branding config parse
  let parsedBranding: { primaryColor?: string; tagLine?: string; enableSms?: boolean; enableEmail?: boolean } = {};
  try {
    if (center.brandingConfig) {
      parsedBranding = JSON.parse(center.brandingConfig);
    }
  } catch {}

  const [primaryColor, setPrimaryColor] = useState(parsedBranding.primaryColor || "#3b82f6");
  const [tagLine, setTagLine] = useState(parsedBranding.tagLine || "");
  const [enableSms, setEnableSms] = useState(parsedBranding.enableSms ?? true);
  const [enableEmail, setEnableEmail] = useState(parsedBranding.enableEmail ?? true);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    const brandingObj = {
      primaryColor,
      tagLine,
      enableSms,
      enableEmail,
    };

    try {
      const res = await fetch("/api/tenant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          legalName: legalName || null,
          inn: inn || null,
          contactPerson: contactPerson || null,
          phone: phone || null,
          email: email || null,
          address: address || null,
          logoUrl: logoUrl || null,
          defaultLanguage,
          timeZone,
          gradingScale,
          brandingConfig: JSON.stringify(brandingObj),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update center settings");

      setSaveSuccess(true);
      if (data.center) {
        setCenter(data.center);
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving settings";
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Settings className="w-7 h-7 text-brand-400" />
            {locale === "uz" ? "O'quv markazi sozlamalari" : "Настройки учебного центра"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {locale === "uz"
              ? "Markaz profili, kontaktlar, baholash tizimi va brending parametrlari"
              : "Профиль центра, реквизиты, локализация, шкала оценок и каналы связи"}
          </p>
        </div>

        {/* Quick Link to Academic Calendar */}
        <Link
          href="/center/settings/calendar"
          className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Calendar className="w-4 h-4 text-brand-400" />
          <span>{locale === "uz" ? "O'quv kalendari" : "Академический календарь"}</span>
          <ExternalLink className="w-3 h-3 text-slate-500" />
        </Link>
      </div>

      {/* Subscription Guard Notice */}
      {center.subscription && (
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  {locale === "uz" ? "Joriy tarif" : "Текущий тариф"}:
                </span>
                <span className="text-sm font-bold text-white">{center.subscription.planName}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {center.subscription.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {locale === "uz"
                  ? "Markaz tarifi va faollik holati platforma super-administratori tomonidan boshqariladi."
                  : "Статус центра и тарифный план регулируются платформой и не могут быть изменены вручную."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("general")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "general"
              ? "bg-brand-500 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          {locale === "uz" ? "Asosiy ma'lumotlar" : "Основные данные"}
        </button>

        <button
          onClick={() => setActiveTab("academic")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "academic"
              ? "bg-brand-500 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          {locale === "uz" ? "Baholash va til" : "Оценки и локализация"}
        </button>

        <button
          onClick={() => setActiveTab("branding")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "branding"
              ? "bg-brand-500 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          {locale === "uz" ? "Brending" : "Брендинг"}
        </button>

        <button
          onClick={() => setActiveTab("notifications")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === "notifications"
              ? "bg-brand-500 text-white shadow-sm"
              : "text-slate-400 hover:text-white hover:bg-slate-900"
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          {locale === "uz" ? "Xabarnomalar" : "Уведомления"}
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{locale === "uz" ? "Sozlamalar muvaffaqiyatli saqlandi" : "Настройки успешно сохранены"}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Tab 1: General */}
        {activeTab === "general" && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white mb-2">
              {locale === "uz" ? "Markaz profili va rekvizitlari" : "Реквизиты и контакты центра"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Markaz nomi" : "Название центра"} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canManage}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Yuridik nomi" : "Юридическое наименование (ООО/ЧП)"}
                </label>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  disabled={!canManage}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "STIR / INN" : "ИНН организации"}
                </label>
                <input
                  type="text"
                  value={inn}
                  onChange={(e) => setInn(e.target.value)}
                  disabled={!canManage}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Mas'ul shaxs (direktor)" : "Контактное лицо"}
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  disabled={!canManage}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Telefon raqami" : "Номер телефона"}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canManage}
                  placeholder="+998901234567"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Elektron pochta" : "Email для уведомлений"}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canManage}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Bosh ofis manzili" : "Фактический адрес центра"}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!canManage}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Academic & Localization */}
        {activeTab === "academic" && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white mb-2">
              {locale === "uz" ? "Baholash tizimi va til" : "Шкала оценок и региональные стандарты"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Baholash shkalasi" : "Шкала оценивания"}
                </label>
                <select
                  value={gradingScale}
                  onChange={(e) => setGradingScale(e.target.value as typeof gradingScale)}
                  disabled={!canManage}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="PERCENT_100">
                    {locale === "uz" ? "100 ballik foiz shkalasi (0-100%)" : "100-балльная процентная шкала (0-100%)"}
                  </option>
                  <option value="POINTS_5">
                    {locale === "uz" ? "5 ballik an'anaviy shkala (1-5)" : "5-балльная традиционная шкала (1-5)"}
                  </option>
                  <option value="PASS_FAIL">
                    {locale === "uz" ? "Sinov / Sinovsiz (Zachyot)" : "Зачет / Незачет (Pass/Fail)"}
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Asosiy til" : "Язык интерфейса по умолчанию"}
                </label>
                <select
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value as typeof defaultLanguage)}
                  disabled={!canManage}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="ru">Русский</option>
                  <option value="uz-Latn">O&apos;zbekcha (Lotin)</option>
                  <option value="uz-Cyrl">Ўзбекча (Кирилл)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Vaqt mintaqasi (Time Zone)" : "Часовой пояс"}
                </label>
                <input
                  type="text"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  disabled={!canManage}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Branding */}
        {activeTab === "branding" && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white mb-2">
              {locale === "uz" ? "Markaz brendi va tashqi ko'rinishi" : "Брендинг и фирменный стиль"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Logotip URL manzili" : "Ссылка на логотип (URL)"}
                </label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  disabled={!canManage}
                  placeholder="https://... yoki /api/upload/..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Asosiy rang" : "Основной цвет бренда"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={!canManage}
                    className="w-9 h-9 p-0.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={!canManage}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {locale === "uz" ? "Shior / Ta'rif" : "Слоган учебного центра"}
                </label>
                <input
                  type="text"
                  value={tagLine}
                  onChange={(e) => setTagLine(e.target.value)}
                  disabled={!canManage}
                  placeholder={locale === "uz" ? "Bilim — kelajak asosi" : "Знания — ключ к успеху"}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Notifications */}
        {activeTab === "notifications" && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white mb-2">
              {locale === "uz" ? "Xabarnoma kanallarini boshqarish" : "Каналы доставки уведомлений"}
            </h3>

            <div className="space-y-4 text-xs">
              <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSms}
                  onChange={(e) => setEnableSms(e.target.checked)}
                  disabled={!canManage}
                  className="mt-0.5 rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-white">
                    {locale === "uz" ? "SMS xabarnomalar (Eskiz.uz orqali)" : "SMS-уведомления (через Eskiz.uz)"}
                  </span>
                  <p className="text-slate-400 mt-0.5">
                    {locale === "uz"
                      ? "O'quvchilar va ota-onalarga login/parol, darsga kelmaganlik va qarzlar to'g'risida SMS yuborish."
                      : "Автоматическая отправка SMS с паролями, долгами и пропусками занятий на узбекские номера."}
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableEmail}
                  onChange={(e) => setEnableEmail(e.target.checked)}
                  disabled={!canManage}
                  className="mt-0.5 rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-white">
                    {locale === "uz" ? "Email xabarnomalar (EmailOutbox bilan)" : "Email-рассылка (с очередью и повторами)"}
                  </span>
                  <p className="text-slate-400 mt-0.5">
                    {locale === "uz"
                      ? "Elektron pochta orqali taklifnomalar va hisobotlarni yuborish."
                      : "Отправка приглашений, подтверждений и квитанций на электронную почту."}
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Submit Button */}
        {canManage && (
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-brand-950/20 flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? (locale === "uz" ? "Saqlanmoqda..." : "Сохранение...") : (locale === "uz" ? "Saqlash" : "Сохранить настройки")}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
