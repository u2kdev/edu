"use client";

import type { FormEvent } from "react";
import { ArrowRightLeft } from "lucide-react";
import { t } from "@/i18n";
import { transferTargets, type GroupItem } from "./groups-utils";

interface TransferStudentModalProps {
  locale: string;
  studentName: string;
  sourceGroupId: string;
  groups: GroupItem[];
  targetGroupId: string;
  onTargetGroupIdChange: (value: string) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  reasonPlaceholder: string;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function TransferStudentModal({
  locale,
  studentName,
  sourceGroupId,
  groups,
  targetGroupId,
  onTargetGroupIdChange,
  reason,
  onReasonChange,
  reasonPlaceholder,
  loading,
  onSubmit,
  onClose,
}: TransferStudentModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-800 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-brand-400" />
          <span>{t(locale, "groups.transferStudent")}</span>
        </h3>

        <p className="text-xs text-slate-300">
          {t(locale, "groups.studentLabel", { name: studentName })}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "groups.transferTarget")}
            </label>
            <select
              required
              value={targetGroupId}
              onChange={(e) => onTargetGroupIdChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
            >
              {transferTargets(groups, sourceGroupId).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.enrollments.length} / {g.maxStudents})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "groups.transferReasonLabel")}
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder={reasonPlaceholder}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
            >
              {t(locale, "common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-brand-600/30"
            >
              {loading ? t(locale, "common.loading") : t(locale, "groups.transferStudent")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
