"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ShieldCheck, ArrowRight } from "lucide-react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  const hasMinLength = newPassword.length >= 8;
  const hasLower = /[a-z]/.test(newPassword);
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const isFormValid = hasMinLength && hasLower && hasUpper && hasNumber && isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setErrorBanner("");
    setSuccessBanner("");
    setLoading(true);

    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorBanner(data.error || "Не удалось изменить пароль");
        return;
      }

      setSuccessBanner("Пароль успешно обновлен! Перенаправление...");
      setTimeout(() => {
        router.push(data.redirectUrl || "/center");
        router.refresh();
      }, 1500);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Произошла ошибка при сохранении");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-theme="light" className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Смена пароля</h1>
            <p className="text-xs text-slate-500">Установите новый надёжный пароль для вашей учётной записи</p>
          </div>
        </div>

        <div className="mb-6 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Требуется сменить пароль</p>
            <p className="mt-0.5 text-amber-700">
              Для продолжения работы в системе необходимо установить постоянный персональный пароль.
            </p>
          </div>
        </div>

        {errorBanner && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {successBanner && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Текущий пароль
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Новый пароль
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Подтверждение нового пароля
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Complexity indicators */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
            <div className={`flex items-center gap-2 ${hasMinLength ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Минимум 8 символов</span>
            </div>
            <div className={`flex items-center gap-2 ${hasLower ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Строчные буквы (a-z)</span>
            </div>
            <div className={`flex items-center gap-2 ${hasUpper ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Заглавные буквы (A-Z)</span>
            </div>
            <div className={`flex items-center gap-2 ${hasNumber ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Цифры (0-9)</span>
            </div>
            <div className={`flex items-center gap-2 ${isMatch ? "text-emerald-600 font-medium" : "text-slate-400"}`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Пароли совпадают</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!isFormValid || loading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            {loading ? "Сохранение..." : "Сохранить новый пароль"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
