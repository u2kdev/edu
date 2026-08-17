import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Megaphone, Pin, Clock, Users, BookOpen } from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";

export default async function AnnouncementsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const activeRole = session.activeCenterRole || "";
  const currentMembership = session.memberships.find((m) => m.centerId === centerId);

  const now = new Date();

  // Role-scoped query
  let whereCondition: any = {
    centerId,
    publishAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
  };

  if (activeRole !== "DIRECTOR" && activeRole !== "CENTER_ADMIN") {
    whereCondition.AND = [
      {
        OR: [
          { targetRole: null },
          { targetRole: activeRole },
        ],
      },
    ];
  }

  const announcements = await db.announcement.findMany({
    where: whereCondition,
    include: {
      author: { include: { user: { select: { fullName: true } } } },
      group: { select: { id: true, name: true } },
    },
    orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }],
    take: 50,
  });

  const pinned = announcements.filter((a) => a.isPinned);
  const regular = announcements.filter((a) => !a.isPinned);

  const roleLabels: Record<string, string> = {
    STUDENT: "Ученики",
    TEACHER: "Преподаватели",
    PARENT: "Родители",
    CENTER_ADMIN: "Администраторы",
    TEACHER_ASSISTANT: "Помощники",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-brand-400" />
            Объявления
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {announcements.length === 0
              ? "Нет актуальных объявлений"
              : `${announcements.length} актуальных объявлений`}
          </p>
        </div>
      </div>

      {announcements.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center">
          <Megaphone className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-1">Нет объявлений</h3>
          <p className="text-sm text-slate-500">Новые объявления появятся здесь</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pinned Announcements */}
          {pinned.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Pin className="w-4 h-4 text-amber-400" />
                Закреплённые
              </h3>
              {pinned.map((announcement) => (
                <div
                  key={announcement.id}
                  className="glass-panel p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3"
                >
                  <AnnouncementCard announcement={announcement} locale={locale} roleLabels={roleLabels} isPinned />
                </div>
              ))}
            </div>
          )}

          {/* Regular Announcements */}
          {regular.length > 0 && (
            <div className="space-y-3">
              {pinned.length > 0 && (
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  Все объявления
                </h3>
              )}
              {regular.map((announcement) => (
                <div
                  key={announcement.id}
                  className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-3"
                >
                  <AnnouncementCard announcement={announcement} locale={locale} roleLabels={roleLabels} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({
  announcement,
  locale,
  roleLabels,
  isPinned = false,
}: {
  announcement: any;
  locale: string;
  roleLabels: Record<string, string>;
  isPinned?: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isPinned && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-semibold">
                <Pin className="w-2.5 h-2.5" />
                ЗАКРЕПЛЕНО
              </span>
            )}
            {announcement.targetRole && (
              <span className="px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-[10px] font-semibold">
                <Users className="w-2.5 h-2.5 inline mr-1" />
                {roleLabels[announcement.targetRole] || announcement.targetRole}
              </span>
            )}
            {announcement.group && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                <BookOpen className="w-2.5 h-2.5 inline mr-1" />
                {announcement.group.name}
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white">{announcement.title}</h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDateLocalized(announcement.publishAt, locale)}
          </div>
          {announcement.expiresAt && (
            <div className="text-[10px] text-amber-500 mt-0.5">
              До: {formatDateLocalized(announcement.expiresAt, locale)}
            </div>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
        {announcement.body}
      </p>

      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Автор: <span className="text-slate-400">{announcement.author.user.fullName}</span>
        </span>
      </div>
    </>
  );
}
