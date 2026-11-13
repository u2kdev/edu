import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Globe, Sparkles } from "lucide-react";
import { getPlatformSetting, type PlatformSeoSetting } from "@/lib/platform-settings";
import SEOFormClient from "./SEOFormClient";

export default async function SEOAdminPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const allowedRoles = ["SUPERADMIN", "PLATFORM_ADMIN", "SEO_ADMIN", "FULL_ACCESS"];
  if (!allowedRoles.includes(session.user.platformRole)) {
    redirect("/center");
  }

  let seo: PlatformSeoSetting | null = null;
  try {
    seo = await getPlatformSetting("platform.seo");
  } catch {
    seo = null;
  }

  const defaultTitle =
    seo?.metaTitleRu || "AcademiaSaaS — Multi-tenant LMS платформа для учебных центров";
  const defaultDesc =
    seo?.metaDescRu ||
    "Закрытая LMS-система для офлайн и онлайн учебных центров. Ведение курсов, групп, расписания и оценок без комиссии с учеников.";
  const defaultOgImage = seo?.ogImageUrl || "https://academiasaas.com/og-banner.png";
  const defaultKeywords =
    seo?.keywords || "LMS, учебный центр, CRM для курсов, Узбекистан LMS, образование";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100">
            Панель SEO и Контента Платформы
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
            Управление мета-тегами, анонсами и блогами платформы
          </p>
        </div>
      </div>

      <SEOFormClient
        initialTitle={defaultTitle}
        initialDesc={defaultDesc}
        initialOgImage={defaultOgImage}
        initialKeywords={defaultKeywords}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              <span>Мета-теги Главной Страницы (SEO)</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Meta Title (ru)
                </label>
                <input
                  type="text"
                  name="metaTitleRu"
                  defaultValue={defaultTitle}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Meta Description (ru)
                </label>
                <textarea
                  rows={3}
                  name="metaDescRu"
                  defaultValue={defaultDesc}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span>OpenGraph & Социальные сети</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  OG Image URL
                </label>
                <input
                  type="text"
                  name="ogImageUrl"
                  defaultValue={defaultOgImage}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Ключевые слова (Keywords)
                </label>
                <input
                  type="text"
                  name="keywords"
                  defaultValue={defaultKeywords}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-900 dark:text-zinc-100 text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </SEOFormClient>
    </div>
  );
}
