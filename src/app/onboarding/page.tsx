import Link from "next/link";
import { Building2, ShieldAlert, ArrowRight } from "lucide-react";

export default function OnboardingInfoPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 text-center">
        <div className="inline-flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-brand-500/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Закрытый Мультитенантный Режим</h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Новые учебные центры (`LearningCenter`) регистрируются **исключительно Администратором Платформы** через платформенную панель управления.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 text-left space-y-2">
            <p><strong>Для Директоров центров:</strong> Платформа высылает персональную ссылку и логин после заключения договора аренды LMS.</p>
            <p><strong>Для Учеников и Учителей:</strong> Доступ в воркспейс осуществляется по инвайт-коду от вашего центра.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/login"
              className="flex-1 py-3 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2"
            >
              <span>Войти в систему</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
