import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Globe, FileText, Sparkles, Tag, CheckCircle2 } from "lucide-react";
import { t } from "@/i18n";

export default async function SEOAdminPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const allowedRoles = ["SUPERADMIN", "PLATFORM_ADMIN", "SEO_ADMIN", "FULL_ACCESS"];
  if (!allowedRoles.includes(session.user.platformRole)) {
    redirect("/center");
  }

  const locale = session.user.preferredLanguage;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Панель SEO и Контента Платформы</h2>
          <p className="text-sm text-slate-400 mt-0.5">Управление мета-тегами, анонсами и блогами платформы</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-400" />
            <span>Мета-теги Главной Страницы (SEO)</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Meta Title (ru)</label>
              <input
                type="text"
                defaultValue="AcademiaSaaS — Multi-tenant LMS платформа для учебных центров"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Meta Description (ru)</label>
              <textarea
                rows={3}
                defaultValue="Закрытая LMS-система для офлайн и онлайн учебных центров. Ведение курсов, групп, расписания и оценок без комиссии с учеников."
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
              />
            </div>
            <button className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs rounded-xl transition-all">
              Сохранить SEO теги
            </button>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span>OpenGraph & Социальные сети</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">OG Image URL</label>
              <input
                type="text"
                defaultValue="https://academiasaas.com/og-banner.png"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Ключевые слова (Keywords)</label>
              <input
                type="text"
                defaultValue="LMS, учебный центр, CRM для курсов, Узбекистан LMS, образование"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
