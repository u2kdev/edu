"use client";

import { Clock, RotateCcw, Send, User } from "lucide-react";
import { t } from "@/i18n";
import {
  STATUS_BADGES,
  findMySubmission,
  formatDueDate,
  studentStatus,
  type HomeworkItem,
  type HomeworkSubmission,
} from "./homework-utils";

interface HomeworkListItemProps {
  hw: HomeworkItem;
  locale: string;
  userMembershipId?: string;
  isStudent: boolean;
  isTeacher: boolean;
  onOpenSubmit: (hw: HomeworkItem) => void;
  onOpenGrade: (hwId: string, sub: HomeworkSubmission) => void;
}

export function HomeworkListItem({
  hw,
  locale,
  userMembershipId,
  isStudent,
  isTeacher,
  onOpenSubmit,
  onOpenGrade,
}: HomeworkListItemProps) {
  const mySubmission = findMySubmission(hw, userMembershipId);
  const myStatus = studentStatus(hw, userMembershipId);
  const badgeCfg = STATUS_BADGES[myStatus] || STATUS_BADGES.NOT_SUBMITTED;

  return (
    <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800 space-y-4 hover:border-slate-700 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
            {hw.lessonTitle}
          </span>
          <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
            {hw.title}
          </h3>
          {hw.description && (
            <p className="text-sm text-slate-400 mt-1">{hw.description}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {hw.dueDate && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold rounded-full">
              <Clock className="w-3.5 h-3.5" />
              <span>{formatDueDate(hw.dueDate)}</span>
            </span>
          )}

          {isStudent && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badgeCfg.color}`}>
              {t(locale, badgeCfg.labelKey)}
            </span>
          )}
        </div>
      </div>

      {/* Student Action Bar */}
      {isStudent && (
        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {mySubmission?.grade !== null && mySubmission?.grade !== undefined ? (
              <span className="font-bold text-emerald-400 mr-2">
                {t(locale, "performance.title")}: {mySubmission.grade}/100
              </span>
            ) : null}
            {mySubmission?.feedback && (
              <span className="italic text-slate-400">
                &quot;{mySubmission.feedback}&quot;
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenSubmit(hw)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors flex items-center justify-center gap-1.5"
          >
            {mySubmission ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t(locale, "homework.submitHomework")}</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{t(locale, "homework.submitHomework")}</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Teacher Submissions View */}
      {isTeacher && hw.submissions.length > 0 && (
        <div className="pt-3 border-t border-slate-800 space-y-2">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {t(locale, "homework.submitted")}: {hw.submissions.length}
          </h4>
          <div className="divide-y divide-slate-800/80">
            {hw.submissions.map((sub) => {
              const subBadge = STATUS_BADGES[sub.status] || STATUS_BADGES.SUBMITTED;
              return (
                <div
                  key={sub.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-medium text-white">
                      {sub.studentName}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold border ${subBadge.color}`}>
                      {t(locale, subBadge.labelKey)}
                    </span>
                    {sub.grade !== null && (
                      <span className="font-bold text-brand-400">
                        {sub.grade}/100
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenGrade(hw.id, sub)}
                    className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors self-start sm:self-auto"
                  >
                    {t(locale, "homework.gradeHomework")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
