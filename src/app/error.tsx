"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="glass-panel max-w-md w-full p-8 rounded-3xl border border-slate-800 text-center">
        <h1 className="text-2xl font-bold text-white mb-3">Что-то пошло не так</h1>
        <p className="text-sm text-slate-400 mb-6">
          Произошла непредвиденная ошибка. Попробуйте обновить страницу или повторить действие.
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
