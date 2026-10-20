"use client";

import { ArrowRightLeft, Edit2, UserCheck, UserMinus } from "lucide-react";
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

      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
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
          <ul className="space-y-1.5 text-xs text-slate-300 max-h-56 overflow-y-auto pr-1">
            {group.enrollments.map((en) => (
              <li
                key={en.id}
                className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/60"
              >
                <div>
                  <span className="font-semibold text-white block">
                    {en.student.user.fullName}
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    {en.student.user.phone || en.student.user.email}
                  </span>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1.5">
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
