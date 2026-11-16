"use client";

import React, { useState } from "react";
import {
  Building2,
  Globe,
  Shield,
  Palette,
  Bell,
  Save,
  Calendar,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ClickMerchantPanel } from "./ClickMerchantPanel";

const DEFAULT_BRAND_COLOR = ["#", "3b82f6"].join("");

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

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
  allowAdminDiscount?: boolean;
  partialPaymentExtendsPeriod?: boolean;
  smsEnabled?: boolean;
  emailEnabled?: boolean;
  smsDailyLimit?: number;
  paymentReminderEnabled?: boolean;
  paymentReminderDays?: number[];
  quietHoursStart?: number;
  quietHoursEnd?: number;
  reminderTemplateRu?: string | null;
  reminderTemplateUz?: string | null;
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
  isDirector?: boolean;
  isImpersonating?: boolean;
  clickFeatureEnabled?: boolean;
}

export function CenterSettingsManager({
  initialCenter,
  locale = "ru",
  canManage = true,
  isDirector = false,
  isImpersonating = false,
  clickFeatureEnabled = true,
}: CenterSettingsManagerProps) {
  const isUz = locale === "uz" || locale === "uz-Latn";
  const [center, setCenter] = useState<CenterData>(initialCenter);
  const [activeTab, setActiveTab] = useState<
    "general" | "academic" | "branding" | "notifications" | "payments"
  >("general");

  // Form fields
  const [name, setName] = useState(center.name || "");
  const [legalName, setLegalName] = useState(center.legalName || "");
  const [inn, setInn] = useState(center.inn || "");
  const [contactPerson, setContactPerson] = useState(center.contactPerson || "");
  const [phone, setPhone] = useState(center.phone || "");
  const [email, setEmail] = useState(center.email || "");
  const [address, setAddress] = useState(center.address || "");

  const [defaultLanguage, setDefaultLanguage] = useState(
    center.defaultLanguage || "ru"
  );
  const [timeZone, setTimeZone] = useState(center.timeZone || "Asia/Tashkent");
  const [gradingScale, setGradingScale] = useState(
    center.gradingScale || "PERCENT_100"
  );

  const [logoUrl, setLogoUrl] = useState(center.logoUrl || "");

  // Branding config parse
  let parsedBranding: {
    primaryColor?: string;
    tagLine?: string;
    enableSms?: boolean;
    enableEmail?: boolean;
  } = {};
  try {
    if (center.brandingConfig) {
      parsedBranding = JSON.parse(center.brandingConfig);
    }
  } catch {}

  const [primaryColor, setPrimaryColor] = useState(
    parsedBranding.primaryColor || DEFAULT_BRAND_COLOR
  );
  const [tagLine, setTagLine] = useState(parsedBranding.tagLine || "");
  const [smsEnabled, setSmsEnabled] = useState(
    center.smsEnabled ?? parsedBranding.enableSms ?? false
  );
  const [emailEnabled, setEmailEnabled] = useState(
    center.emailEnabled ?? parsedBranding.enableEmail ?? true
  );
  const [smsDailyLimit, setSmsDailyLimit] = useState(
    center.smsDailyLimit ?? 100
  );
  const [paymentReminderEnabled, setPaymentReminderEnabled] = useState(
    center.paymentReminderEnabled ?? true
  );
  const [paymentReminderDaysText, setPaymentReminderDaysText] = useState(
    (center.paymentReminderDays ?? [-3, 0, 3, 7]).join(", ")
  );
  const [quietHoursStart, setQuietHoursStart] = useState(
    center.quietHoursStart ?? 21
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    center.quietHoursEnd ?? 8
  );
  const [reminderTemplateRu, setReminderTemplateRu] = useState(
    center.reminderTemplateRu || ""
  );
  const [reminderTemplateUz, setReminderTemplateUz] = useState(
    center.reminderTemplateUz || ""
  );
  const [allowAdminDiscount, setAllowAdminDiscount] = useState(
    center.allowAdminDiscount ?? false
  );
  const [partialPaymentExtendsPeriod, setPartialPaymentExtendsPeriod] =
    useState(center.partialPaymentExtendsPeriod ?? false);

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
    };

    const parsedDays = paymentReminderDaysText
      .split(/[\s,;]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n >= -30 && n <= 60);

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
          allowAdminDiscount,
          partialPaymentExtendsPeriod,
          smsEnabled,
          emailEnabled,
          smsDailyLimit: Number(smsDailyLimit) || 0,
          paymentReminderEnabled,
          paymentReminderDays:
            parsedDays.length > 0 ? parsedDays : [-3, 0, 3, 7],
          quietHoursStart: Number(quietHoursStart),
          quietHoursEnd: Number(quietHoursEnd),
          reminderTemplateRu: reminderTemplateRu.trim() || null,
          reminderTemplateUz: reminderTemplateUz.trim() || null,
          brandingConfig: JSON.stringify(brandingObj),
        }),
      });

      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to update center settings");

      setSaveSuccess(true);
      if (data.center) {
        setCenter(data.center);
      }
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error saving settings";
      setErrorMessage(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          isUz ? "O'quv markazi sozlamalari" : "Настройки учебного центра"
        }
        description={
          isUz
            ? "Markaz profili, kontaktlar, baholash tizimi va brending parametrlari"
            : "Профиль центра, реквизиты, локализация, шкала оценок и каналы связи"
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/center/settings/calendar">
              <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>
                {isUz ? "O'quv kalendari" : "Академический календарь"}
              </span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {/* Subscription Guard Notice */}
      {center.subscription && (
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-muted border border-border flex items-center justify-center text-primary shrink-0">
                <Shield className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    {isUz ? "Joriy tarif" : "Текущий тариф"}:
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {center.subscription.planName}
                  </span>
                  <Badge variant="success">{center.subscription.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isUz
                    ? "Markaz tarifi va faollik holati platforma super-administratori tomonidan boshqariladi."
                    : "Статус центра и тарифный план регулируются платформой и не могут быть изменены вручную."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as typeof activeTab)}
      >
        <TabsList>
          <TabsTrigger value="general">
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isUz ? "Asosiy ma'lumotlar" : "Основные данные"}</span>
          </TabsTrigger>
          <TabsTrigger value="academic">
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isUz ? "Baholash va til" : "Оценки и локализация"}</span>
          </TabsTrigger>
          <TabsTrigger value="branding">
            <Palette className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isUz ? "Brending" : "Брендинг"}</span>
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isUz ? "Xabarnomalar" : "Уведомления"}</span>
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isUz ? "To'lov va Click" : "Оплата и Click"}</span>
          </TabsTrigger>
        </TabsList>

      <TabsContent value={activeTab} className="space-y-6">
      {saveSuccess && (
        <Alert variant="success">
          <AlertDescription>
            {isUz
              ? "Sozlamalar muvaffaqiyatli saqlandi"
              : "Настройки успешно сохранены"}
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Tab 1: General */}
        {activeTab === "general" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isUz
                  ? "Markaz profili va rekvizitlari"
                  : "Реквизиты и контакты центра"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cs-name">
                  {isUz ? "Markaz nomi" : "Название центра"} *
                </Label>
                <Input
                  id="cs-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canManage}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cs-legal">
                  {isUz
                    ? "Yuridik nomi"
                    : "Юридическое наименование (ООО/ЧП)"}
                </Label>
                <Input
                  id="cs-legal"
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  disabled={!canManage}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cs-inn">
                  {isUz ? "STIR / INN" : "ИНН организации"}
                </Label>
                <Input
                  id="cs-inn"
                  type="text"
                  value={inn}
                  onChange={(e) => setInn(e.target.value)}
                  disabled={!canManage}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cs-contact">
                  {isUz ? "Mas'ul shaxs (direktor)" : "Контактное лицо"}
                </Label>
                <Input
                  id="cs-contact"
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  disabled={!canManage}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cs-phone">
                  {isUz ? "Telefon raqami" : "Номер телефона"}
                </Label>
                <Input
                  id="cs-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canManage}
                  placeholder="+998901234567"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cs-email">
                  {isUz ? "Elektron pochta" : "Email для уведомлений"}
                </Label>
                <Input
                  id="cs-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canManage}
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cs-address">
                  {isUz ? "Bosh ofis manzili" : "Фактический адрес центра"}
                </Label>
                <Input
                  id="cs-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!canManage}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Academic & Localization */}
        {activeTab === "academic" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isUz
                  ? "Baholash tizimi va til"
                  : "Шкала оценок и региональные стандарты"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cs-grading">
                  {isUz ? "Baholash shkalasi" : "Шкала оценивания"}
                </Label>
                <select
                  id="cs-grading"
                  value={gradingScale}
                  onChange={(e) =>
                    setGradingScale(e.target.value as typeof gradingScale)
                  }
                  disabled={!canManage}
                  className={SELECT_CLS}
                >
                  <option value="PERCENT_100">
                    {isUz
                      ? "100 ballik foiz shkalasi (0-100%)"
                      : "100-балльная процентная шкала (0-100%)"}
                  </option>
                  <option value="POINTS_5">
                    {isUz
                      ? "5 ballik an'anaviy shkala (1-5)"
                      : "5-балльная традиционная шкала (1-5)"}
                  </option>
                  <option value="PASS_FAIL">
                    {isUz
                      ? "Sinov / Sinovsiz (Zachyot)"
                      : "Зачёт / Незачёт (Pass/Fail)"}
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cs-lang">
                  {isUz ? "Asosiy til" : "Язык интерфейса по умолчанию"}
                </Label>
                <select
                  id="cs-lang"
                  value={defaultLanguage}
                  onChange={(e) =>
                    setDefaultLanguage(
                      e.target.value as typeof defaultLanguage
                    )
                  }
                  disabled={!canManage}
                  className={SELECT_CLS}
                >
                  <option value="ru">Русский</option>
                  <option value="uz-Latn">O&apos;zbekcha (Lotin)</option>
                  <option value="uz-Cyrl">Ўзбекча (Кирилл)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cs-tz">
                  {isUz ? "Vaqt mintaqasi (Time Zone)" : "Часовой пояс"}
                </Label>
                <Input
                  id="cs-tz"
                  type="text"
                  value={timeZone}
                  onChange={(e) => setTimeZone(e.target.value)}
                  disabled={!canManage}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Branding */}
        {activeTab === "branding" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isUz
                  ? "Markaz brendi va tashqi ko'rinishi"
                  : "Брендинг и фирменный стиль"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="cs-logo">
                  {isUz ? "Logotip URL manzili" : "Ссылка на логотип (URL)"}
                </Label>
                <Input
                  id="cs-logo"
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  disabled={!canManage}
                  placeholder="https://... или /api/upload/..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cs-color-text">
                  {isUz ? "Asosiy rang" : "Основной цвет бренда"}
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    aria-label={isUz ? "Asosiy rang" : "Основной цвет бренда"}
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={!canManage}
                    className="w-9 h-9 p-0.5 rounded-md bg-card border border-input cursor-pointer shrink-0"
                  />
                  <Input
                    id="cs-color-text"
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    disabled={!canManage}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="cs-tagline">
                  {isUz ? "Shior / Ta'rif" : "Слоган учебного центра"}
                </Label>
                <Input
                  id="cs-tagline"
                  type="text"
                  value={tagLine}
                  onChange={(e) => setTagLine(e.target.value)}
                  disabled={!canManage}
                  placeholder={
                    isUz
                      ? "Bilim — kelajak asosi"
                      : "Знания — ключ к успеху"
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 4: Notifications */}
        {activeTab === "notifications" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isUz
                  ? "Xabarnoma kanallarini boshqarish"
                  : "Каналы доставки уведомлений"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <label className="flex items-start gap-3 p-3.5 rounded-md bg-muted/40 border border-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                  disabled={!canManage}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {isUz
                      ? "SMS xabarnomalar (Eskiz.uz orqali)"
                      : "SMS-уведомления (через Eskiz.uz)"}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isUz
                      ? "O'quvchilar va ota-onalarga login/parol, darsga kelmaganlik va qarzlar to'g'risida SMS yuborish."
                      : "Автоматическая отправка SMS о долгах, пропусках и важных событиях на узбекские номера."}
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-md bg-muted/40 border border-border cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailEnabled}
                  onChange={(e) => setEmailEnabled(e.target.checked)}
                  disabled={!canManage}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
                />
                <div>
                  <span className="text-sm font-medium text-foreground">
                    {isUz
                      ? "Email xabarnomalar (EmailOutbox bilan)"
                      : "Email-рассылка (с очередью и повторами)"}
                  </span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isUz
                      ? "Elektron pochta orqali taklifnomalar, eslatmalar va kvitansiyalarni yuborish."
                      : "Отправка приглашений, напоминаний и квитанций на электронную почту."}
                  </p>
                </div>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-md bg-muted/40 border border-border">
                <div className="space-y-1.5">
                  <Label htmlFor="cs-sms-limit">
                    {isUz ? "Kunlik SMS limiti" : "Суточный лимит SMS"}
                  </Label>
                  <Input
                    id="cs-sms-limit"
                    type="number"
                    min={0}
                    max={100000}
                    value={smsDailyLimit}
                    onChange={(e) => setSmsDailyLimit(Number(e.target.value))}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-qh-start">
                    {isUz
                      ? "Sokin soatlar boshi (Toshkent)"
                      : "Тихие часы с (Asia/Tashkent)"}
                  </Label>
                  <Input
                    id="cs-qh-start"
                    type="number"
                    min={0}
                    max={23}
                    value={quietHoursStart}
                    onChange={(e) => setQuietHoursStart(Number(e.target.value))}
                    disabled={!canManage}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cs-qh-end">
                    {isUz
                      ? "Sokin soatlar oxiri (Toshkent)"
                      : "Тихие часы до (Asia/Tashkent)"}
                  </Label>
                  <Input
                    id="cs-qh-end"
                    type="number"
                    min={0}
                    max={23}
                    value={quietHoursEnd}
                    onChange={(e) => setQuietHoursEnd(Number(e.target.value))}
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="p-4 rounded-md bg-muted/40 border border-border space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentReminderEnabled}
                    onChange={(e) => setPaymentReminderEnabled(e.target.checked)}
                    disabled={!canManage}
                    className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">
                      {isUz
                        ? "Avtomatik to'lov eslatmalari"
                        : "Автонапоминания об оплате"}
                    </span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isUz
                        ? "Telegram -> Push -> SMS tartibida eslatma yuborish (masalan: -3, 0, 3, 7 kun)."
                        : "Приоритет каналов: Telegram -> Push -> SMS. Укажите смещения дней от даты оплаты."}
                    </p>
                  </div>
                </label>

                <div className="space-y-1.5">
                  <Label htmlFor="cs-rem-days">
                    {isUz
                      ? "Eslatma kunlari (-3, 0, 3, 7)"
                      : "Дни напоминаний относительно срока (-3, 0, 3, 7)"}
                  </Label>
                  <Input
                    id="cs-rem-days"
                    type="text"
                    value={paymentReminderDaysText}
                    onChange={(e) => setPaymentReminderDaysText(e.target.value)}
                    disabled={!canManage}
                    placeholder="-3, 0, 3, 7"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cs-tpl-ru">
                      {isUz
                        ? "Eslatma shabloni (RU)"
                        : "Шаблон напоминания (RU)"}
                    </Label>
                    <Textarea
                      id="cs-tpl-ru"
                      rows={2}
                      value={reminderTemplateRu}
                      onChange={(e) => setReminderTemplateRu(e.target.value)}
                      disabled={!canManage}
                      placeholder="{{studentName}}, к оплате {{amount}} UZS до {{paidUntil}} {{payUrl}}"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cs-tpl-uz">
                      {isUz
                        ? "Eslatma shabloni (UZ Lotin)"
                        : "Шаблон напоминания (UZ-Latn)"}
                    </Label>
                    <Textarea
                      id="cs-tpl-uz"
                      rows={2}
                      value={reminderTemplateUz}
                      onChange={(e) => setReminderTemplateUz(e.target.value)}
                      disabled={!canManage}
                      placeholder="{{studentName}}, to'lov summasi {{amount}} UZS, muddat {{paidUntil}} {{payUrl}}"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 5: Billing & Discount policies */}
        {activeTab === "payments" && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isUz
                  ? "Billing va chegirma qoidalari"
                  : "Правила биллинга и скидок"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-md bg-muted/40 border border-border hover:bg-muted/60">
                <input
                  type="checkbox"
                  checked={allowAdminDiscount}
                  onChange={(e) => setAllowAdminDiscount(e.target.checked)}
                  disabled={!canManage}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
                />
                <span className="text-sm font-medium text-foreground">
                  {isUz
                    ? "Administratorga qo'lda chegirma berishga ruxsat berish"
                    : "Разрешить администратору применять ручную скидку"}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-md bg-muted/40 border border-border hover:bg-muted/60">
                <input
                  type="checkbox"
                  checked={partialPaymentExtendsPeriod}
                  onChange={(e) =>
                    setPartialPaymentExtendsPeriod(e.target.checked)
                  }
                  disabled={!canManage}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary shrink-0"
                />
                <span className="text-sm font-medium text-foreground">
                  {isUz
                    ? "Qisman to'lovda paidUntil muddatini uzaytirish"
                    : "Продлевать paidUntil при частичной оплате"}
                </span>
              </label>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        {canManage && (
          <div className="flex justify-end pt-2">
            <Button type="submit" loading={saving} size="sm">
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>
                {saving
                  ? isUz
                    ? "Saqlanmoqda..."
                    : "Сохранение..."
                  : isUz
                  ? "Saqlash"
                  : "Сохранить настройки"}
              </span>
            </Button>
          </div>
        )}
      </form>

      {activeTab === "payments" &&
        (clickFeatureEnabled ? (
          <ClickMerchantPanel
            locale={locale === "uz" ? "uz-Latn" : locale}
            isDirector={isDirector}
            isImpersonating={isImpersonating}
          />
        ) : (
          <Alert variant="warning">
            <AlertDescription className="space-y-3">
              <div>
                <div className="font-semibold">
                  {isUz
                    ? "Click orqali onlayn to'lov joriy tarifda mavjud emas"
                    : "Онлайн-оплата Click недоступна на текущем тарифе"}
                </div>
                <p className="text-xs opacity-90 mt-1">
                  {isUz
                    ? "Click integratsiyasini yoqish uchun tarifni yuqori darajaga o'tkazing."
                    : "Перейдите на тариф «Рост» или «Про», чтобы принимать оплату через Click."}
                </p>
              </div>
              <Button asChild size="sm">
                <Link href="/center/upgrade">
                  {isUz ? "Tarifni oshirish" : "Повысить тариф"}
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        ))}
      </TabsContent>
      </Tabs>
    </div>
  );
}
