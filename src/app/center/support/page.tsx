import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { HelpCircle, MessageSquare, Plus, Clock } from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";

export default async function CenterSupportPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const locale = session.user.preferredLanguage;

  const tickets = await db.supportTicket.findMany({
    where: {
      OR: [
        { creatorUserId: session.user.id },
        ...(session.activeCenterId ? [{ centerId: session.activeCenterId }] : []),
      ],
    },
    include: {
      creator: { select: { fullName: true, email: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{t(locale, "support.title")}</h2>
          <p className="text-sm text-slate-400 mt-0.5">{t(locale, "support.createTicket")}</p>
        </div>
      </div>

      <div className="space-y-4">
        {tickets.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
            <HelpCircle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">{t(locale, "common.noData")}</p>
          </div>
        ) : (
          tickets.map((tkt) => (
            <div key={tkt.id} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                    {tkt.scope}
                  </span>
                  <h3 className="text-base font-bold text-white mt-1">{tkt.subject}</h3>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  tkt.status === "OPEN"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : tkt.status === "RESOLVED"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-800 text-slate-400"
                }`}>
                  {t(locale, "support.status" + tkt.status.charAt(0) + tkt.status.slice(1).toLowerCase())}
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                {tkt.messages.map((m) => (
                  <div key={m.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300">
                    <div className="text-[10px] text-slate-500 mb-1">{formatDateLocalized(m.createdAt, locale)}</div>
                    <p>{m.message}</p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
