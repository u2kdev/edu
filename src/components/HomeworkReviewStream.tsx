"use client";

import { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Send, Loader2, FileText } from "lucide-react";
import { t } from "@/i18n";

interface Submission {
  id: string;
  homeworkId: string;
  studentMembershipId: string;
  submissionText: string | null;
  filesJson: string | null;
  grade: number | null;
  feedback: string | null;
  student: {
    user: {
      fullName: string;
      email: string;
    };
  };
}

interface HomeworkReviewStreamProps {
  homeworkTitle: string;
  submissions: Submission[];
  locale?: string;
  onGradedSuccess?: () => void;
}

export default function HomeworkReviewStream({
  homeworkTitle,
  submissions,
  locale = "ru",
  onGradedSuccess,
}: HomeworkReviewStreamProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gradeInput, setGradeInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const quickFeedbacks = [
    t(locale, "homework.templateExcellent"),
    t(locale, "homework.templateFormatting"),
    t(locale, "homework.templateAccepted"),
    t(locale, "homework.templateNeedsRevision"),
  ];

  if (submissions.length === 0) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
        <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">{t(locale, "homework.noPendingReview")}</p>
      </div>
    );
  }

  const currentSub = submissions[currentIndex];

  const handleNext = () => {
    if (currentIndex < submissions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setGradeInput(submissions[currentIndex + 1]?.grade?.toString() || "");
      setFeedbackInput(submissions[currentIndex + 1]?.feedback || "");
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setGradeInput(submissions[currentIndex - 1]?.grade?.toString() || "");
      setFeedbackInput(submissions[currentIndex - 1]?.feedback || "");
    }
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSub || saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GRADE",
          homeworkId: currentSub.homeworkId,
          studentMembershipId: currentSub.studentMembershipId,
          grade: gradeInput ? parseInt(gradeInput) : 100,
          feedback: feedbackInput,
        }),
      });

      if (res.ok) {
        onGradedSuccess?.();
        if (currentIndex < submissions.length - 1) {
          handleNext();
        }
      } else {
        alert(t(locale, "homework.saveGradeError"));
      }
    } catch {
      alert(t(locale, "homework.networkError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      {/* Stream Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
            {t(locale, "homework.reviewStreamTitle", { current: currentIndex + 1, total: submissions.length })}
          </span>
          <h3 className="text-base font-bold text-white mt-0.5">{homeworkTitle}</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-400">
            {currentIndex + 1} / {submissions.length}
          </span>
          <button
            onClick={handleNext}
            disabled={currentIndex === submissions.length - 1}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Student Submission Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div>
              <div className="font-bold text-white">{currentSub.student.user.fullName}</div>
              <div className="text-xs text-slate-500">{currentSub.student.user.email}</div>
            </div>
            {currentSub.grade !== null && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
                {t(locale, "homework.gradedSummary", { grade: currentSub.grade })}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t(locale, "homework.studentAnswer")}</span>
            <div className="p-3 rounded-lg bg-slate-950 text-sm text-slate-200 whitespace-pre-wrap font-mono min-h-[100px]">
              {currentSub.submissionText || t(locale, "homework.noTextAnswer")}
            </div>
          </div>
        </div>

        {/* Grading Form */}
        <form onSubmit={handleGradeSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "homework.scoreRange")}
            </label>
            <input
              type="number"
              min="0"
              max="100"
              required
              value={gradeInput}
              onChange={(e) => setGradeInput(e.target.value)}
              placeholder="e.g. 95"
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono font-bold focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "homework.quickTemplates")}
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {quickFeedbacks.map((tf, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFeedbackInput(tf)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors text-left"
                >
                  + {tf.slice(0, 25)}...
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={feedbackInput}
              onChange={(e) => setFeedbackInput(e.target.value)}
              placeholder={t(locale, "homework.teacherCommentPlaceholder")}
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{t(locale, "homework.saveAndNext")}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
