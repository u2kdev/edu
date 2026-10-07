import { requireTenantAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { getTenantDb } from "@/lib/db-tenant";
import { redirect } from "next/navigation";
import { BookOpen, Clock, FileText, CheckCircle2 } from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";

export default async function CenterHomeworkPage() {
  const tenantCtx = await requireTenantAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;

  const homeworks = await getTenantDb(tenantCtx.center.id).homework.findMany({
    where: {
      lesson: { module: { course: { centerId } } },
    },
    include: {
      lesson: { select: { title: true } },
      materials: { include: { material: true } },
      submissions: {
        include: {
          student: { include: { user: { select: { fullName: true, email: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{t(locale, "homework.title")}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{t(locale, "homework.createHomework")}</p>
        </div>
      </div>

      <div className="space-y-4">
        {homeworks.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">{t(locale, "common.noData")}</p>
          </div>
        ) : (
          homeworks.map((hw) => (
            <div key={hw.id} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                    {hw.lesson.title}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1">{hw.title}</h3>
                  {hw.description && (
                    <p className="text-sm text-slate-400 mt-1">{hw.description}</p>
                  )}
                </div>
                {hw.dueDate && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold rounded-full">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatDateLocalized(hw.dueDate, locale)}</span>
                  </span>
                )}
              </div>

              {hw.materials.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800/60">
                  {hw.materials.map((m) => (
                    <span key={m.id} className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs font-medium rounded-lg flex items-center gap-1">
                      <FileText className="w-3 h-3 text-brand-400" />
                      <span>{m.material.title} ({t(locale, "materials." + m.material.materialType.toLowerCase())})</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
