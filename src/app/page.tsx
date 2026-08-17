import Link from "next/link";
import { Shield, BookOpen, Users, CheckCircle2, ArrowRight, Sparkles, Building2, CreditCard, Lock } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">Academia<span className="text-brand-400">SaaS</span></span>
              <span className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Multi-tenant LMS Platform</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-brand-400 transition-colors">Возможности</a>
            <a href="#architecture" className="hover:text-brand-400 transition-colors">Мультитенантность</a>
            <a href="#pricing" className="hover:text-brand-400 transition-colors">Тарифы подписки</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Войти в систему
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white rounded-xl shadow-lg shadow-brand-600/30 transition-all transform hover:-translate-y-0.5"
            >
              Подключить центр
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-6 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[140px] pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-brand-500/30 text-brand-400 text-xs font-semibold uppercase tracking-wider mb-8 shadow-inner">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Закрытая LMS-платформа для учебных центров</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Единое пространство для вашего <br />
            <span className="gradient-text">учебного центра, учителей и учеников</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Размещайте офлайн- и онлайн-курсы, ведите расписание, оценки и посещаемость. 
            Платформа работает по **фиксированной месячной подписке** — мы не берем комиссию с ваших учеников!
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-xl shadow-brand-600/25 transition-all transform hover:-translate-y-1 flex items-center justify-center gap-3"
            >
              <span>Создать воркспейс центра</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 glass-panel hover:bg-slate-800/80 text-slate-200 font-semibold rounded-2xl border border-slate-700 transition-all flex items-center justify-center gap-3"
            >
              <Lock className="w-4 h-4 text-brand-400" />
              <span>Войти по инвайт-коду</span>
            </Link>
          </div>

          {/* Interactive Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-brand-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Закрытая система (Не маркетплейс)</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Никаких сторонних каталогов и конкурентов. Доступ учеников и родителей строго по инвайт-ссылке вашего центра.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-brand-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">0% комиссия с курсов</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Вы платите только за фиксированную аренду платформы. Деньги за курсы от учеников поступают напрямую вам.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-brand-500/40 transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Кабинет Родителя</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Двусторонняя безопасная привязка родителя к ребенку для контроля оценок, успеваемости и посещаемости.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-slate-900/50 border-t border-slate-800/80 relative">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-white mb-4">Прозрачные тарифы аренды</h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-16">
            Выберите подходящий тариф для вашего учебного центра. Начните с **14 дней бесплатного trial-периода**.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Plan 1 */}
            <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-left flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Старт</h3>
                <p className="text-xs text-slate-400 mb-6">Для небольших студий и репетиторских центров</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">2 900 ₽</span>
                  <span className="text-sm text-slate-400">/месяц</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    <span>До 50 активных учеников</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    <span>До 5 преподавателей</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    <span>Журнал посещаемости и ДЗ</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register?plan=start"
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all text-center"
              >
                Попробовать 14 дней
              </Link>
            </div>

            {/* Plan 2 */}
            <div className="glass-panel p-8 rounded-3xl border-2 border-brand-500/80 text-left flex flex-col justify-between relative shadow-2xl shadow-brand-500/10">
              <div className="absolute -top-3.5 right-6 px-3 py-1 bg-gradient-to-r from-brand-600 to-indigo-600 text-white text-xs font-bold uppercase rounded-full tracking-wider">
                Популярный
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Профессиональный</h3>
                <p className="text-xs text-slate-400 mb-6">Для средних офлайн- и онлайн-академий</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">7 900 ₽</span>
                  <span className="text-sm text-slate-400">/месяц</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    <span>До 250 активных учеников</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    <span>До 20 преподавателей</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    <span>Кастомный брендинг центра</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    <span>Кабинет родителя + SMS</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register?plan=pro"
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all text-center shadow-lg shadow-brand-600/30"
              >
                Подключить Pro
              </Link>
            </div>

            {/* Plan 3 */}
            <div className="glass-panel p-8 rounded-3xl border border-slate-800 text-left flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Безлимит</h3>
                <p className="text-xs text-slate-400 mb-6">Для крупных сетей учебных центров</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-white">19 900 ₽</span>
                  <span className="text-sm text-slate-400">/месяц</span>
                </div>
                <ul className="space-y-3 text-sm text-slate-300 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    <span>Неограниченное число учеников</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    <span>До 100 преподавателей</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-400" />
                    <span>Персональный менеджер</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register?plan=unlimited"
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all text-center"
              >
                Связаться с нами
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-800 text-center text-xs text-slate-500">
        <p>© 2026 AcademiaSaaS Platform. Все права защищены. Закрытая LMS-система для учебных центров.</p>
      </footer>
    </div>
  );
}
