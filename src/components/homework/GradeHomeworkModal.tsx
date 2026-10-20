"use client";

import type { FormEvent } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { t } from "@/i18n";
import { parseSubmissionLinks, type GradeTarget } from "./homework-utils";

interface GradeHomeworkModalProps {
  locale: string;
  target: GradeTarget;
  gradeValue: string;
  onGradeValueChange: (value: string) => void;
  gradeStatus: string;
  onGradeStatusChange: (value: string) => void;
  feedbackText: string;
  onFeedbackTextChange: (value: string) => void;
  isGrading: boolean;
  gradeError: string | null;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function GradeHomeworkModal({
  locale,
  target,
  gradeValue,
  onGradeValueChange,
  gradeStatus,
  onGradeStatusChange,
  feedbackText,
  onFeedbackTextChange,
  isGrading,
  gradeError,
  onSubmit,
  onClose,
}: GradeHomeworkModalProps) {
  const submissionLinks = target.filesJson ? parseSubmissionLinks(target.filesJson) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-lg space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-brand-400" />
          <span>
            {t(locale, "homework.gradeHomework")} — {target.studentName}
          </span>
        </h3>

        {target.submissionText && (
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span className="font-semibold text-slate-400 block mb-1">
              {t(locale, "homework.solutionLabel")}
            </span>
            {target.submissionText}
          </div>
        )}

        {target.filesJson && (
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
            <span className="font-semibold text-slate-400 block mb-1">
              {t(locale, "homework.linksLabel")}
            </span>
            {submissionLinks === null ? (
              <span>{target.filesJson}</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {submissionLinks.map((l, i) => (
                  <a
                    key={i}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-400 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>{l.title || l.url}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {gradeError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{gradeError}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {t(locale, "homework.scoreLabel")}
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={gradeValue}
                onChange={(e) => onGradeValueChange(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                {t(locale, "common.status")}
              </label>
              <select
                value={gradeStatus}
                onChange={(e) => onGradeStatusChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="ACCEPTED">{t(locale, "homework.accepted")}</option>
                <option value="REVISION_REQUESTED">
                  {t(locale, "homework.revisionRequested")}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              {t(locale, "homework.feedback")}
            </label>
            <textarea
              value={feedbackText}
              onChange={(e) => onFeedbackTextChange(e.target.value)}
              rows={3}
              placeholder="..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-800 hover:bg-slate-800 text-slate-400 transition-colors"
            >
              {t(locale, "common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isGrading}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isGrading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>...</span>
                </>
              ) : (
                <span>{t(locale, "homework.gradeHomework")}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
