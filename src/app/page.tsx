import Link from "next/link";
import { Shield, BookOpen, Users, CheckCircle2, ArrowRight, Sparkles, Building2, CreditCard, Lock, MapPin, MonitorPlay, Calendar, MessageCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-[#0077FF] selection:text-white">
      {/* Navigation Bar - VK / Yandex Style (Clean, White, Sticky) */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#0077FF] flex items-center justify-center shadow-md">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-gray-900">Academia<span className="text-[#0077FF]">Uz</span></span>
              <span className="block text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Tashkent Edition</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#about" className="hover:text-[#0077FF] transition-colors">О нас</a>
            <a href="#how-it-works" className="hover:text-[#0077FF] transition-colors">Как это работает</a>
            <a href="#features" className="hover:text-[#0077FF] transition-colors">Возможности</a>
            <a href="#pricing" className="hover:text-[#0077FF] transition-colors">Тарифы</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors border border-purple-200"
            >
              Админка (Dev)
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 text-sm font-medium bg-[#0077FF] hover:bg-[#0066CC] text-white rounded-lg shadow-sm transition-all"
            >
              Подключить центр
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden bg-white">
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E5F1FF] text-[#0077FF] text-xs font-semibold uppercase tracking-wider mb-8">
            <MapPin className="w-3.5 h-3.5" />
            <span>Разработано в Ташкенте для учебных центров</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
            Умная платформа для <br />
            <span className="text-[#0077FF]">управления образованием</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            Современная LMS в стиле лучших экосистем (Yandex / VK). Ведите расписание, оценки, онлайн-уроки и учет финансов в одном удобном интерфейсе. Идеально для учебных центров Узбекистана.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-[#0077FF] hover:bg-[#0066CC] text-white font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-3"
            >
              <span>Попробовать бесплатно</span>
              <ArrowRight className="w-5 h-5" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-xl transition-all flex items-center justify-center gap-3"
            >
              <Lock className="w-4 h-4 text-gray-500" />
              <span>Вход для учеников</span>
            </Link>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="about" className="py-20 px-6 bg-[#F5F5F7]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">О нас</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Мы — команда разработчиков из Ташкента. Наша миссия — дать учебным центрам удобный, быстрый и современный инструмент без лишней перегруженности.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Почему мы?</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-[#E5F1FF] rounded-lg text-[#0077FF] mt-1"><Sparkles className="w-5 h-5" /></div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Интерфейс, к которому привыкли</h4>
                    <p className="text-sm text-gray-600 mt-1">Дизайн вдохновлен VK и Яндексом: крупные элементы, мягкие тени и ничего лишнего.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="p-2 bg-[#E5F1FF] rounded-lg text-[#0077FF] mt-1"><Shield className="w-5 h-5" /></div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Надежность и безопасность</h4>
                    <p className="text-sm text-gray-600 mt-1">Данные хранятся на защищенных серверах, доступ строго по инвайтам.</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="h-full min-h-[300px] bg-gradient-to-br from-[#0077FF] to-[#00A3FF] rounded-3xl p-8 flex flex-col justify-center text-white relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
              <h3 className="text-3xl font-bold mb-4 relative z-10">Сделано для вас</h3>
              <p className="text-white/90 relative z-10">Мы изучили потребности локальных центров в Ташкенте и создали систему, которая решает реальные задачи.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6 bg-white border-y border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Как работает система</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Всего три простых шага для автоматизации вашего учебного процесса.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-[#E5F1FF] text-[#0077FF] rounded-2xl flex items-center justify-center mb-6 text-2xl font-bold">1</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Создание центра</h3>
              <p className="text-gray-600">Регистрируете свой воркспейс, настраиваете брендинг и добавляете преподавателей.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-[#E5F1FF] text-[#0077FF] rounded-2xl flex items-center justify-center mb-6 text-2xl font-bold">2</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Добавление групп</h3>
              <p className="text-gray-600">Создаете курсы, формируете расписание и приглашаете учеников по безопасным ссылкам.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-[#E5F1FF] text-[#0077FF] rounded-2xl flex items-center justify-center mb-6 text-2xl font-bold">3</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Обучение и контроль</h3>
              <p className="text-gray-600">Проводите занятия, отмечаете посещаемость, ставите оценки, а родители получают уведомления.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-[#F5F5F7]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Ключевые возможности</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Все необходимые инструменты в одном месте.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Умное расписание</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Интерактивный календарь занятий, пересечение аудиторий и автоматические уведомления.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 mb-4">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Мессенджер и чаты</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Встроенные чаты групп как в VK: обсуждения, обмен файлами и общение с преподавателем.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 mb-4">
                <MonitorPlay className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Онлайн уроки (Видео)</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Интеграция с Zoom/Meet и собственная видео-платформа для проведения онлайн-трансляций.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Кабинет Родителя</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Отдельный доступ для родителей: контроль успеваемости, оплат и посещаемости ребенка.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 mb-4">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Финансы и оплаты</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Учет оплат (Click, Payme), задолженности учеников и зарплаты преподавателей.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700 mb-4">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Материалы курса</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Хранилище лекций, тестов и домашних заданий с автоматической проверкой.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Прозрачные тарифы</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-16">
            Оплата в сумах, без скрытых комиссий. Первые 14 дней — бесплатно.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Plan 1 */}
            <div className="bg-white p-8 rounded-3xl border border-gray-200 text-left flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Базовый</h3>
                <p className="text-xs text-gray-500 mb-6">Для небольших учебных центров</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">490 тыс</span>
                  <span className="text-sm text-gray-500">сум/мес</span>
                </div>
                <ul className="space-y-3 text-sm text-gray-700 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0077FF]" />
                    <span>До 100 учеников</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0077FF]" />
                    <span>Расписание и учет</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register?plan=start"
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-xl transition-all text-center"
              >
                Начать бесплатно
              </Link>
            </div>

            {/* Plan 2 */}
            <div className="bg-white p-8 rounded-3xl border-2 border-[#0077FF] text-left flex flex-col justify-between relative shadow-xl">
              <div className="absolute -top-3.5 right-6 px-3 py-1 bg-[#0077FF] text-white text-xs font-bold uppercase rounded-full tracking-wider">
                Популярный
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Оптимальный</h3>
                <p className="text-xs text-gray-500 mb-6">Для средних школ и академий</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">990 тыс</span>
                  <span className="text-sm text-gray-500">сум/мес</span>
                </div>
                <ul className="space-y-3 text-sm text-gray-700 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0077FF]" />
                    <span>До 500 учеников</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0077FF]" />
                    <span>Интеграция оплат (Payme/Click)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0077FF]" />
                    <span>Кабинет родителя</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register?plan=pro"
                className="w-full py-3 bg-[#0077FF] hover:bg-[#0066CC] text-white font-semibold rounded-xl transition-all text-center"
              >
                Выбрать тариф
              </Link>
            </div>

            {/* Plan 3 */}
            <div className="bg-white p-8 rounded-3xl border border-gray-200 text-left flex flex-col justify-between hover:shadow-lg transition-shadow">
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Корпоративный</h3>
                <p className="text-xs text-gray-500 mb-6">Для крупных сетей филиалов</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold text-gray-900">Индивидуально</span>
                </div>
                <ul className="space-y-3 text-sm text-gray-700 mb-8">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0077FF]" />
                    <span>Безлимит по ученикам</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0077FF]" />
                    <span>Поддержка 24/7</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#0077FF]" />
                    <span>Кастомные доработки</span>
                  </li>
                </ul>
              </div>
              <Link
                href="/register?plan=unlimited"
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-xl transition-all text-center"
              >
                Связаться
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-[#1D1D1F] text-gray-400 text-center text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 AcademiaUz Platform. Сделано в Ташкенте.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">Политика конфиденциальности</a>
            <a href="#" className="hover:text-white transition-colors">Условия использования</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
