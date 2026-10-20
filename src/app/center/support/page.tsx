import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { HelpCircle, MessageSquare, Plus, Clock } from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";

// Ticket statuses are snake_case in the DB, while the catalog keys are camelCase
// (`support.statusInProgress`). Build the key explicitly so multi-word statuses
// do not fall through to a raw i18n key.
const SUPPORT_STATUS_KEYS: Record<string, string> = {
  OPEN: "support.statusOpen",
  IN_PROGRESS: "support.statusInProgress",
  RESOLVED: "support.statusResolved",
  CLOSED: "support.statusClosed",
};

function supportStatusKey(status: string): string {
  return SUPPORT_STATUS_KEYS[status] ?? status;
}

export default async function CenterSupportPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;

  const tickets = await tenantCtx.getTenantDb().supportTicket.findMany({
    where: {
      OR: [
        { creatorUserId: session.user.id },
        { centerId },
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
                  {t(locale, supportStatusKey(tkt.status))}
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
