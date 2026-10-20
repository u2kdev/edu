import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="glass-panel max-w-md w-full p-8 rounded-3xl border border-slate-800 text-center">
        <h1 className="text-5xl font-black text-brand-400 mb-2">404</h1>
        <p className="text-lg font-semibold text-white mb-2">Страница не найдена</p>
        <p className="text-sm text-slate-400 mb-6">
          Возможно, она была перемещена или удалена.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all inline-block"
        >
          На главную
        </Link>
      </div>
    </div>
  );
}
