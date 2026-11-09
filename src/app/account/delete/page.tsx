"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle, ShieldAlert, KeyRound, ArrowLeft } from "lucide-react";

export default function AccountDeletePage() {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleted, setIsDeleted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMessage("Введите пароль для подтверждения удаления");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/account/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data: unknown = await res.json().catch(() => ({}));
      const typedData = data as { success?: boolean; error?: { message?: string; code?: string } };

      if (!res.ok) {
        if (typedData.error?.code === "SOLE_DIRECTOR_CONFLICT") {
          setErrorMessage(
            "Невозможно удалить аккаунт: вы являетесь единственным директором центра. Назначьте другого директора перед удалением."
          );
        } else {
          setErrorMessage(typedData.error?.message || "Ошибка при удалении аккаунта");
        }
        setIsSubmitting(false);
        return;
      }

      setIsDeleted(true);
      setTimeout(() => {
        window.location.href = "/login";
      }, 3000);
    } catch {
      setErrorMessage("Сетевая ошибка при обращении к серверу");
      setIsSubmitting(false);
    }
  };

  if (isDeleted) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="glass-panel max-w-md w-full p-8 rounded-3xl border border-slate-800 text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Аккаунт успешно удалён</h2>
          <p className="text-slate-400 text-sm">
            Все персональные данные анонимизированы, а сессии отозваны. Вы будете перенаправлены на страницу входа.
          </p>
          <div className="pt-4">
            <Link
              href="/login"
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-sm font-semibold inline-block"
            >
              Войти
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="glass-panel max-w-lg w-full p-8 rounded-3xl border border-slate-800 space-y-6">
        <div>
          <Link
            href="/center/profile"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад в профиль
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
              <ShieldAlert className="w-8 h-8 text-rose-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Удаление учётной записи</h1>
              <p className="text-xs text-slate-400">Необратимое действие</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800 space-y-3 text-xs text-slate-300">
          <div className="flex items-start gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-semibold">Что произойдёт после удаления:</span>
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-slate-400">
            <li>Ваше имя, email и номер телефона будут полностью анонимизированы.</li>
            <li>Все активные сессии на сайте и в мобильном приложении будут немедленно закрыты.</li>
            <li>Родительские связи с учащимися будут расторгнуты.</li>
            <li>
              Академические записи (оценки и посещаемость) сохраняются в центрах в обезличенном виде для отчётности.
            </li>
            <li>
              Если вы единственный директор учебного центра, сначала передайте роль директора другому сотруднику.
            </li>
          </ul>
        </div>

        {errorMessage && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Для подтверждения введите ваш текущий пароль
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ваш пароль"
                required
                className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/center/profile"
              className="px-4 py-2 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-rose-600/20"
            >
              {isSubmitting ? "Удаление..." : "Удалить мой аккаунт"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
