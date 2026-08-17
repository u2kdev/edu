"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, FileText, Send, Sparkles, Loader2 } from "lucide-react";

interface Submission {
  id: string;
  homeworkId: string;
  studentMembershipId: string;
  submissionText: string | null;
  filesJson: string | null;
  grade: number | null;
  feedback: string | null;
  submittedAt: string;
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
  onGradedSuccess?: () => void;
}

const QUICK_FEEDBACKS = [
  "Отличная работа! Все требования выполнены на 100%.",
  "Хорошее решение, но обрати внимание на форматирование кода.",
  "Принято! Можешь переходить к следующему уроку.",
  "Требуется доработка. Исправь указанные ошибки и ответь снова.",
];

export default function HomeworkReviewStream({
  homeworkTitle,
  submissions,
  onGradedSuccess,
}: HomeworkReviewStreamProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [gradeInput, setGradeInput] = useState<string>("");
  const [feedbackInput, setFeedbackInput] = useState<string>("");
  const [saving, setSaving] = useState(false);

  if (submissions.length === 0) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
        <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">Нет работ, ожидающих проверки</p>
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
    setSaving(true);
    try {
      const res = await fetch("/api/homework", {
        method: "PATCH",
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
        alert("Ошибка сохранения оценки");
      }
    } catch (err) {
      alert("Ошибка сети");
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
            Поток проверки ДЗ ({currentIndex + 1} из {submissions.length})
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
                Оценено: {currentSub.grade} / 100
              </span>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ответ ученика:</span>
            <div className="p-3 rounded-lg bg-slate-950 text-sm text-slate-200 whitespace-pre-wrap font-mono min-h-[100px]">
              {currentSub.submissionText || "Текстовый ответ отсутствует"}
            </div>
          </div>
        </div>

        {/* Grading Form */}
        <form onSubmit={handleGradeSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Оценка (0 — 100)
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
              Быстрые шаблоны отзывов
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {QUICK_FEEDBACKS.map((tf, i) => (
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
              placeholder="Комментарий учителя для ученика..."
              className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Сохранить и Перейти к следующему (Enter)</span>
          </button>
        </form>
      </div>
    </div>
  );
}
