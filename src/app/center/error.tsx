"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertOctagon, HelpCircle, RefreshCw } from "lucide-react";

export default function CenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string; code?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Center page error caught by error boundary:", error);
  }, [error]);

  const isSuspended =
    error.message?.includes("Tenant suspended") ||
    error.message?.includes("CENTER_SUSPENDED") ||
    (error as { code?: string })?.code === "CENTER_SUSPENDED";

  if (isSuspended) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="glass-panel max-w-xl w-full p-8 rounded-3xl border border-rose-500/30 bg-rose-500/5 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Доступ к центру приостановлен</h2>
            <p className="text-sm text-slate-300 mt-2">
              Действие учебного центра временно заблокировано или истек срок действия подписки.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/center/suspended"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-colors"
            >
              Подробнее о статусе
            </Link>
            <Link
              href="/center/support"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              <HelpCircle className="w-4 h-4" />
              Поддержка
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="glass-panel max-w-lg w-full p-8 rounded-3xl border border-slate-800 text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
          <AlertOctagon className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Произошла ошибка</h2>
          <p className="text-sm text-slate-400 mt-2">
            {error.message || "Не удалось загрузить раздел. Попробуйте обновить страницу."}
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-sm transition-colors inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
