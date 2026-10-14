"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Building2, CheckCircle2 } from "lucide-react";

const schemaStep1 = z.object({
  name: z.string().min(2, "Название должно содержать не менее 2 символов"),
  slug: z
    .string()
    .min(2, "Slug должен содержать не менее 2 символов")
    .regex(/^[a-z0-9-]+$/, "Slug может содержать только строчные латинские буквы, цифры и дефис"),
  phone: z.string().min(5, "Укажите контактный номер телефона"),
  email: z.string().email("Некорректный email адрес"),
  timeZone: z.string().min(1, "Укажите часовой пояс"),
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
    slug: "",
    phone: "",
    email: "",
    timeZone: "Asia/Tashkent",
    status: "TRIAL",
    trialEndsAt: "",
    directorEmail: "",
    directorFullName: "",
    directorPhone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
      if (newId) {
        router.push(`/platform-admin/centers/${newId}`);
      } else {
        router.push("/platform-admin/centers");
      }
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "Не удалось создать центр");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/centers"
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Создание учебного центра</h1>
            <p className="text-xs text-slate-500 mt-0.5">Пошаговая регистрация новой организации в e-darischi</p>
          </div>
        </div>
      </div>

      {/* Stepper Wizard Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        {[
          { num: 1, label: "Данные центра" },
          { num: 2, label: "Статус доступа" },
          { num: 3, label: "Директор" },
          { num: 4, label: "Подтверждение" },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                step >= s.num ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}
            >
              {s.num}
            </div>
            <span
              className={`text-xs font-semibold hidden sm:inline ${
                step >= s.num ? "text-slate-900" : "text-slate-400"
              }`}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Step Contents */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Шаг 1: Основные реквизиты центра</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Название центра</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Например: Al-Beruniy Academy"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              />
              {errors.name && <p className="text-rose-600 text-xs mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Поддомен / Slug (только латиница и дефисы)
              </label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="al-beruniy"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono"
              />
              {errors.slug && <p className="text-rose-600 text-xs mt-1">{errors.slug}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Телефон организации</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+998 90 123 45 67"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              />
              {errors.phone && <p className="text-rose-600 text-xs mt-1">{errors.phone}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email организации</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="info@center.uz"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              />
              {errors.email && <p className="text-rose-600 text-xs mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Часовой пояс</label>
              <select
                name="timeZone"
                value={formData.timeZone}
                onChange={handleChange}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              >
                <option value="Asia/Tashkent">Asia/Tashkent (Узбекистан, UTC+5)</option>
                <option value="Asia/Samarkand">Asia/Samarkand (UTC+5)</option>
                <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Шаг 2: Начальный статус доступа</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Статус подписки</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              >
                <option value="TRIAL">TRIAL (Пробный период)</option>
                <option value="ACTIVE">ACTIVE (Активный платный)</option>
              </select>
            </div>
            {formData.status === "TRIAL" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Дата окончания пробного периода
                </label>
                <input
                  type="date"
                  name="trialEndsAt"
                  value={formData.trialEndsAt}
                  onChange={handleChange}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Шаг 3: Директор учебного центра</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">ФИО директора</label>
              <input
                type="text"
                name="directorFullName"
                value={formData.directorFullName}
                onChange={handleChange}
                placeholder="Иван Иванов"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              />
              {errors.directorFullName && (
                <p className="text-rose-600 text-xs mt-1">{errors.directorFullName}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email директора</label>
              <input
                type="email"
                name="directorEmail"
                value={formData.directorEmail}
                onChange={handleChange}
                placeholder="director@center.uz"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              />
              {errors.directorEmail && <p className="text-rose-600 text-xs mt-1">{errors.directorEmail}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Телефон директора</label>
              <input
                type="text"
                name="directorPhone"
                value={formData.directorPhone}
                onChange={handleChange}
                placeholder="+998 90 987 65 43"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              />
              {errors.directorPhone && <p className="text-rose-600 text-xs mt-1">{errors.directorPhone}</p>}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Шаг 4: Проверка и создание</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm">
              <div>
                <span className="text-xs text-slate-500 block">Организация:</span>
                <span className="font-semibold text-slate-900">{formData.name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Slug:</span>
                <span className="font-mono font-semibold text-slate-900">{formData.slug}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Статус:</span>
                <span className="font-semibold text-blue-600">{formData.status}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Директор:</span>
                <span className="font-semibold text-slate-900">
                  {formData.directorFullName} ({formData.directorEmail})
                </span>
              </div>
            </div>
            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
                {submitError}
              </div>
            )}
          </div>
        )}

        {/* Buttons Bar */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || isSubmitting}
            className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Назад
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              Далее
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? "Создание..." : "Завершить и создать"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
