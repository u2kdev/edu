"use client";

import { ArrowRightLeft, Edit2, UserCheck, UserMinus, Phone, MessageCircle, AlertTriangle } from "lucide-react";
import { t } from "@/i18n";
import {
  capacityBadgeClass,
  isGroupFull,
  type GroupEnrollment,
  type GroupItem,
} from "./groups-utils";

interface GroupCardProps {
  group: GroupItem;
  locale: string;
  canEdit: boolean;
  onEdit: (group: GroupItem) => void;
  onTransfer: (group: GroupItem, enrollment: GroupEnrollment) => void;
  onDrop: (group: GroupItem, enrollment: GroupEnrollment) => void;
}

export function GroupCard({
  group,
  locale,
  canEdit,
  onEdit,
  onTransfer,
  onDrop,
}: GroupCardProps) {
  const isFull = isGroupFull(group);

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
            {group.course.title}
          </span>
          <h3 className="text-xl font-bold text-white mt-1">{group.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${capacityBadgeClass(isFull)}`}
          >
            👥 {group.enrollments.length} / {group.maxStudents}
          </span>
          {canEdit && (
            <button
              onClick={() => onEdit(group)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-slate-300 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">
            {group.teacher ? (
              t(locale, "groups.teacherAssigned", {
                name: group.teacher.user.fullName,
              })
            ) : (
              <strong className="text-white">
                {t(locale, "groups.teacherNotAssigned")}
              </strong>
            )}
          </span>
        </div>

        {group.assistant && (
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-slate-300 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="truncate">
              {locale === "uz-Latn" ? "Yordamchi: " : "Ассистент: "}
              <strong className="text-white">{group.assistant.user.fullName}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Student list preview */}
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          {t(locale, "groups.rosterTitle", {
            count: String(group.enrollments.length),
          })}
        </h4>
        {group.enrollments.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            {t(locale, "groups.emptyRoster")}
          </p>
        ) : (
          <ul className="space-y-2 text-xs text-slate-300 max-h-72 overflow-y-auto pr-1">
            {group.enrollments.map((en) => {
              const cleanPhone = en.student.user.phone?.replace(/[^0-9]/g, "");
              const cleanParentPhone = en.student.parentPhone?.replace(/[^0-9]/g, "");

              return (
                <li
                  key={en.id}
                  className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-colors ${
                    en.student.isAtRisk
                      ? "bg-rose-950/20 border-rose-900/40"
                      : "bg-slate-950/60 border-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white block">
                        {en.student.user.fullName}
                      </span>
                      {en.student.attendanceRate !== undefined && en.student.attendanceRate !== null && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                            en.student.isAtRisk
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {en.student.isAtRisk && <AlertTriangle className="w-2.5 h-2.5" />}
                          <span>{en.student.attendanceRate}%</span>
                          {en.student.isAtRisk && (
                            <span>{locale === "uz-Latn" ? "• Xavf ostida" : "• В зоне риска"}</span>
                          )}
                        </span>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          title={t(locale, "groups.transferStudent")}
                          onClick={() => onTransfer(group, en)}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-brand-300 rounded"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title={t(locale, "groups.removeStudent")}
                          onClick={() => onDrop(group, en)}
                          className="p-1 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Student Contacts */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/40">
                    <span className="font-mono">{en.student.user.phone || en.student.user.email}</span>
                    {en.student.user.phone && (
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${en.student.user.phone}`}
                          className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded flex items-center gap-1 text-[11px]"
                          title={locale === "uz-Latn" ? "Qo'ng'iroq qilish" : "Позвонить"}
                        >
                          <Phone className="w-3 h-3 text-emerald-400" />
                          <span>{locale === "uz-Latn" ? "Tel" : "Звонок"}</span>
                        </a>
                        <a
                          href={`https://wa.me/${cleanPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 rounded flex items-center gap-1 text-[11px]"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-400" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Parent Contacts */}
                  {en.student.parentPhone && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/40 bg-slate-900/40 -mx-2.5 -mb-2.5 p-2 rounded-b-xl">
                      <span className="truncate">
                        {locale === "uz-Latn" ? "Ota-onasi: " : "Родитель: "}
                        <strong className="text-slate-200">{en.student.parentName || ""}</strong> (
                        {en.student.parentPhone})
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`tel:${en.student.parentPhone}`}
                          className="text-brand-400 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-2.5 h-2.5" />
                        </a>
                        <a
                          href={`https://wa.me/${cleanParentPhone}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <MessageCircle className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
