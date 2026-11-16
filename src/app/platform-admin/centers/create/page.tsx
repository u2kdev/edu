"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, Copy, ShieldAlert } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  FormField,
  Input,
  PageHeader,
} from "@/components/ui";
import { t } from "@/i18n";

const schemaStep1 = z.object({
  name: z.string().min(2, "Название должно содержать не менее 2 символов"),
  organizationKind: z.enum(["LEARNING_CENTER", "SCHOOL", "KINDERGARTEN", "OTHER"]).default("LEARNING_CENTER"),
  slug: z
    .string()
    .min(2, "Slug должен содержать не менее 2 символов")
    .regex(/^[a-z0-9-]+$/, "Slug может содержать только строчные латинские буквы, цифры и дефис"),
  phone: z.string().min(5, "Укажите контактный номер телефона"),
  email: z.string().email("Некорректный email адрес"),
  timeZone: z.string().min(1, "Укажите часовой пояс"),
  legalName: z.string().optional(),
  inn: z.string().optional(),
  contactPerson: z.string().optional(),
  address: z.string().optional(),
});

const schemaStep2 = z.object({
  status: z.enum(["TRIAL", "ACTIVE", "PAUSED", "OVERDUE", "BLOCKED", "CANCELLED"]),
  trialEndsAt: z.string().optional(),
});

const schemaStep3 = z.object({
  directorEmail: z.string().email("Некорректный email директора"),
  directorFullName: z.string().min(2, "Укажите полное имя директора"),
  directorPhone: z.string().min(5, "Укажите телефон директора"),
});

export default function CreateCenterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    organizationKind: "LEARNING_CENTER",
    slug: "",
    phone: "",
    email: "",
    timeZone: "Asia/Tashkent",
    legalName: "",
    inn: "",
    contactPerson: "",
    address: "",
    status: "TRIAL",
    trialEndsAt: "",
    directorEmail: "",
    directorFullName: "",
    directorPhone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdInfo, setCreatedInfo] = useState<{
    centerId: string;
    name: string;
    directorEmail: string;
    resetUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleNext = () => {
    let result;
    if (step === 1) result = schemaStep1.safeParse(formData);
    else if (step === 2) result = schemaStep2.safeParse(formData);
    else if (step === 3) result = schemaStep3.safeParse(formData);

    if (result && !result.success) {
      const formattedErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0] !== undefined) {
          formattedErrors[String(issue.path[0])] = issue.message;
        }
      });
      setErrors(formattedErrors);
      return;
    }

    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/platform/centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка при создании учебного центра");
      }
      const data = await res.json();
      const newId = data.center?.id || data.data?.id;
      if (data.resetUrl) {
        setCreatedInfo({
          centerId: newId,
          name: formData.name,
          directorEmail: formData.directorEmail,
          resetUrl: data.resetUrl,
        });
      } else if (newId) {
        router.push(`/platform-admin/centers/${newId}`);
      } else {
        router.push("/platform-admin/centers");
      }
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось создать центр");
      setIsSubmitting(false);
    }
  };

  if (createdInfo) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardContent className="space-y-6 p-6 text-center sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-success/30 bg-success-subtle text-success">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Учебный центр создан
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Организация <strong>{createdInfo.name}</strong> зарегистрирована в системе.
              </p>
            </div>

            {createdInfo.resetUrl && (
              <Alert variant="warning" className="text-left">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold">
                    <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{t("ru", "ui4.oneTimeSecretWarn")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      readOnly
                      value={createdInfo.resetUrl}
                      className="flex-1 font-mono text-xs select-all"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(createdInfo.resetUrl || "");
                        setCopied(true);
                        setTimeout(() => setCopied(false), 3000);
                      }}
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copied ? t("ru", "ui4.copied") : t("ru", "ui4.copyCredentials")}</span>
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Передайте ссылку директору ({createdInfo.directorEmail}). Ссылка действует 72 часа для установки пароля.
                  </p>
                </div>
              </Alert>
            )}

            <Button
              type="button"
              variant="primary"
              className="w-full"
              onClick={() => router.push(`/platform-admin/centers/${createdInfo.centerId}`)}
            >
              Перейти в карточку центра
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon" aria-label={t("ru", "common.back")}>
          <Link href="/platform-admin/centers">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <PageHeader
          title="Создание учебного центра"
          description="Пошаговая регистрация новой организации"
        />
      </div>

      <Card>
        <CardContent className="flex items-center justify-between p-4">
          {[
            { num: 1, label: "Данные центра" },
            { num: 2, label: "Статус доступа" },
            { num: 3, label: "Директор" },
            { num: 4, label: "Подтверждение" },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                  step >= s.num
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-muted text-muted-foreground"
                }`}
              >
                {s.num}
              </div>
              <span
                className={`hidden text-xs font-medium sm:inline ${
                  step >= s.num ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6 sm:p-8">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Шаг 1: Основные реквизиты центра
              </h2>

              <FormField label="Тип организации">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {[
                    { value: "LEARNING_CENTER", label: "Учебный центр" },
                    { value: "SCHOOL", label: "Школа" },
                    { value: "KINDERGARTEN", label: "Детский сад" },
                    { value: "OTHER", label: "Другое" },
                  ].map((kind) => {
                    const selected = formData.organizationKind === kind.value;
                    return (
                      <Button
                        key={kind.value}
                        type="button"
                        variant={selected ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setFormData({ ...formData, organizationKind: kind.value })}
                      >
                        {kind.label}
                      </Button>
                    );
                  })}
                </div>
              </FormField>

              <FormField label="Название центра" htmlFor="center-name" required error={errors.name}>
                <Input
                  id="center-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Например: Al-Beruniy Academy"
                />
              </FormField>

              <FormField
                label="Поддомен / Slug (только латиница и дефисы)"
                htmlFor="center-slug"
                required
                error={errors.slug}
              >
                <Input
                  id="center-slug"
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleChange}
                  placeholder="al-beruniy"
                  className="font-mono"
                />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Телефон организации" htmlFor="center-phone" required error={errors.phone}>
                  <Input
                    id="center-phone"
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+998 90 123 45 67"
                  />
                </FormField>
                <FormField label="Email организации" htmlFor="center-email" required error={errors.email}>
                  <Input
                    id="center-email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="info@center.uz"
                  />
                </FormField>
              </div>

              <div className="space-y-4 border-t border-border pt-4">
                <span className="block text-xs font-medium text-muted-foreground">
                  Юридические реквизиты (необязательно)
                </span>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Юр. наименование" htmlFor="center-legal-name">
                    <Input
                      id="center-legal-name"
                      type="text"
                      name="legalName"
                      value={formData.legalName}
                      onChange={handleChange}
                      placeholder="OOO 'AL-BERUNIY EDUCATION'"
                    />
                  </FormField>
                  <FormField label="ИНН" htmlFor="center-inn">
                    <Input
                      id="center-inn"
                      type="text"
                      name="inn"
                      value={formData.inn}
                      onChange={handleChange}
                      placeholder="123456789"
                    />
                  </FormField>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Контактное лицо" htmlFor="center-contact-person">
                    <Input
                      id="center-contact-person"
                      type="text"
                      name="contactPerson"
                      value={formData.contactPerson}
                      onChange={handleChange}
                      placeholder="Иван Иванов"
                    />
                  </FormField>
                  <FormField label="Фактический адрес" htmlFor="center-address">
                    <Input
                      id="center-address"
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      placeholder="г. Ташкент, ул. Навои, 10"
                    />
                  </FormField>
                </div>
              </div>

              <FormField label="Часовой пояс" htmlFor="center-tz">
                <select
                  id="center-tz"
                  name="timeZone"
                  value={formData.timeZone}
                  onChange={handleChange}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="Asia/Tashkent">Asia/Tashkent (Узбекистан, UTC+5)</option>
                  <option value="Asia/Samarkand">Asia/Samarkand (UTC+5)</option>
                  <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
                </select>
              </FormField>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Шаг 2: Начальный статус доступа
              </h2>
              <FormField label="Статус подписки" htmlFor="center-status">
                <select
                  id="center-status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="TRIAL">TRIAL (Пробный период)</option>
                  <option value="ACTIVE">ACTIVE (Активный платный)</option>
                </select>
              </FormField>
              {formData.status === "TRIAL" && (
                <FormField label="Дата окончания пробного периода" htmlFor="center-trial-ends">
                  <Input
                    id="center-trial-ends"
                    type="date"
                    name="trialEndsAt"
                    value={formData.trialEndsAt}
                    onChange={handleChange}
                  />
                </FormField>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Шаг 3: Директор учебного центра
              </h2>
              <FormField label="ФИО директора" htmlFor="director-full-name" required error={errors.directorFullName}>
                <Input
                  id="director-full-name"
                  type="text"
                  name="directorFullName"
                  value={formData.directorFullName}
                  onChange={handleChange}
                  placeholder="Иван Иванов"
                />
              </FormField>
              <FormField label="Email директора" htmlFor="director-email" required error={errors.directorEmail}>
                <Input
                  id="director-email"
                  type="email"
                  name="directorEmail"
                  value={formData.directorEmail}
                  onChange={handleChange}
                  placeholder="director@center.uz"
                />
              </FormField>
              <FormField label="Телефон директора" htmlFor="director-phone" required error={errors.directorPhone}>
                <Input
                  id="director-phone"
                  type="text"
                  name="directorPhone"
                  value={formData.directorPhone}
                  onChange={handleChange}
                  placeholder="+998 90 987 65 43"
                />
              </FormField>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                Шаг 4: Проверка и создание
              </h2>
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-muted/40 p-4 text-sm sm:grid-cols-2">
                <div>
                  <span className="block text-xs text-muted-foreground">Организация:</span>
                  <span className="font-medium text-foreground">{formData.name}</span>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Slug:</span>
                  <span className="font-mono font-medium text-foreground">{formData.slug}</span>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Статус:</span>
                  <Badge variant="info">{formData.status}</Badge>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Директор:</span>
                  <span className="font-medium text-foreground">
                    {formData.directorFullName} ({formData.directorEmail})
                  </span>
                </div>
              </div>
              {submitError && (
                <Alert variant="destructive">
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || isSubmitting}
            >
              Назад
            </Button>

            {step < 4 ? (
              <Button type="button" variant="primary" onClick={handleNext}>
                Далее
              </Button>
            ) : (
              <Button type="button" variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>{isSubmitting ? "Создание..." : "Завершить и создать"}</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
