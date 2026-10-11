"use client";

import { useState, useEffect } from "react";
import {
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Loader2,
  Send,
} from "lucide-react";
import { t } from "@/i18n";

export interface QuestionItem {
  id: string;
  questionText: string;
  questionType: string;
  optionsJson: string | null;
  points: number;
  orderIndex: number;
}

export interface TestDetails {
  id: string;
  title: string;
  timeLimitMinutes: number | null;
  maxAttempts: number;
  passingScorePercent: number;
  questions: QuestionItem[];
}

interface ReviewItem {
  questionId: string;
  questionText: string;
  questionType: string;
  isCorrect: boolean;
  studentAnswer: unknown;
  correctAnswer: unknown;
  points: number;
  maxPoints: number;
}

interface TestRunnerProps {
  test: TestDetails;
  existingAttemptsCount: number;
  locale?: string;
  onComplete?: () => void;
}

export default function TestRunner({
  test,
  existingAttemptsCount,
  locale = "ru",
  onComplete,
}: TestRunnerProps) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Student answers map: questionId -> value (string or string[])
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Result state
  const [result, setResult] = useState<{
    passed: boolean;
    scorePercent: number;
    scorePoints: number;
    maxPoints: number;
    isTimeExceeded: boolean;
    review: ReviewItem[];
  } | null>(null);

  const canAttempt = existingAttemptsCount < test.maxAttempts;

  // Countdown timer effect
  useEffect(() => {
    if (!startedAt || !test.timeLimitMinutes || result !== null) return;

    const interval = setInterval(() => {
      const elapsedSec = Math.floor(
        (Date.now() - new Date(startedAt).getTime()) / 1000
      );
      const totalSec = test.timeLimitMinutes! * 60;
      const left = Math.max(0, totalSec - elapsedSec);
      setSecondsRemaining(left);

      if (left === 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt, test.timeLimitMinutes, result]);

  const handleStart = async () => {
    setIsStarting(true);
    setStartError(null);
    setSubmitError(null);
    setResult(null);
    setAnswers({});

    try {
      const res = await fetch("/api/tests/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId: test.id }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          attemptId: string;
          startedAt: string;
          timeLimitMinutes: number | null;
        };
        setAttemptId(data.attemptId);
        setStartedAt(new Date(data.startedAt));
        if (data.timeLimitMinutes) {
          setSecondsRemaining(data.timeLimitMinutes * 60);
        }
      } else {
        const errData = (await res.json()) as { error?: string };
        setStartError(errData.error || "Failed to start test");
      }
    } catch {
      setStartError("Network error");
    } finally {
      setIsStarting(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleMultipleChoiceToggle = (questionId: string, optionText: string) => {
    const currentList = Array.isArray(answers[questionId])
      ? (answers[questionId] as string[])
      : [];
    const exists = currentList.includes(optionText);
    const updated = exists
      ? currentList.filter((t) => t !== optionText)
      : [...currentList, optionText];
    handleAnswerChange(questionId, updated);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/tests/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: test.id,
          attemptId,
          studentAnswers: answers,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          passed: boolean;
          attempt: {
            scorePercent: number;
            scorePoints: number;
            maxPoints: number;
          };
          isTimeExceeded: boolean;
          review: ReviewItem[];
        };
        setResult({
          passed: data.passed,
          scorePercent: data.attempt.scorePercent,
          scorePoints: data.attempt.scorePoints,
          maxPoints: data.attempt.maxPoints,
          isTimeExceeded: data.isTimeExceeded,
          review: data.review,
        });
        onComplete?.();
      } else {
        const errData = (await res.json()) as { error?: string };
        setSubmitError(errData.error || "Failed to submit test");
      }
    } catch {
      setSubmitError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Award className="w-5 h-5 text-brand-400" />
            <span>{test.title}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {t(locale, "testing.attemptsLeft")}:{" "}
            <span className="text-white font-semibold">
              {Math.max(0, test.maxAttempts - existingAttemptsCount)} / {test.maxAttempts}
            </span>{" "}
            • Проходной балл:{" "}
            <span className="text-white font-semibold">{test.passingScorePercent}%</span>
          </p>
        </div>

        {/* Timer Display */}
        {startedAt && result === null && secondsRemaining !== null && (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-mono font-bold border shrink-0 ${
              secondsRemaining < 60
                ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                : "bg-slate-900 border-slate-700 text-brand-400"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>
        )}
      </div>

      {startError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{startError}</span>
        </div>
      )}

      {/* Screen 1: Not started */}
      {!startedAt && result === null && (
        <div className="p-6 text-center space-y-4">
          <p className="text-sm text-slate-400">
            В тесте {test.questions.length} вопросов.
            {test.timeLimitMinutes
              ? ` На выполнение дается ${test.timeLimitMinutes} минут.`
              : " Время не ограничено."}
          </p>

          <button
            type="button"
            onClick={handleStart}
            disabled={!canAttempt || isStarting}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>...</span>
              </>
            ) : (
              <span>{t(locale, "testing.startTest")}</span>
            )}
          </button>
        </div>
      )}

      {/* Screen 2: In-Progress Test */}
      {startedAt && result === null && (
        <div className="space-y-6">
          <div className="space-y-6">
            {test.questions.map((q, idx) => {
              let options: Array<{ text: string }> = [];
              if (q.optionsJson) {
                try {
                  options = JSON.parse(q.optionsJson) as Array<{ text: string }>;
                } catch {
                  options = [];
                }
              }

              return (
                <div
                  key={q.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-white text-sm">
                      {idx + 1}. {q.questionText}
                    </span>
                    <span className="text-xs text-slate-500 font-mono shrink-0">
                      {q.points} б.
                    </span>
                  </div>

                  {/* SINGLE_CHOICE */}
                  {q.questionType === "SINGLE_CHOICE" && (
                    <div className="space-y-2">
                      {options.map((opt, oIdx) => (
                        <label
                          key={oIdx}
                          className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs text-slate-300"
                        >
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            value={opt.text}
                            checked={answers[q.id] === opt.text}
                            onChange={() => handleAnswerChange(q.id, opt.text)}
                            className="text-brand-500"
                          />
                          <span>{opt.text}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* MULTIPLE_CHOICE */}
                  {q.questionType === "MULTIPLE_CHOICE" && (
                    <div className="space-y-2">
                      {options.map((opt, oIdx) => {
                        const selectedList = Array.isArray(answers[q.id])
                          ? (answers[q.id] as string[])
                          : [];
                        const isChecked = selectedList.includes(opt.text);
                        return (
                          <label
                            key={oIdx}
                            className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs text-slate-300"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleMultipleChoiceToggle(q.id, opt.text)}
                              className="text-brand-500 rounded"
                            />
                            <span>{opt.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* TRUE_FALSE */}
                  {q.questionType === "TRUE_FALSE" && (
                    <div className="flex gap-2">
                      {["true", "false"].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleAnswerChange(q.id, val)}
                          className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                            answers[q.id] === val
                              ? "bg-brand-500 text-white border-brand-400"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          {val === "true" ? "Истина (True)" : "Ложь (False)"}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* TEXT */}
                  {q.questionType === "TEXT" && (
                    <input
                      type="text"
                      value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder="Введите ответ..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {submitError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{t(locale, "testing.submitTest")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Screen 3: Test Review & Results */}
      {result !== null && (
        <div className="space-y-6">
          {/* Result Banner */}
          <div
            className={`p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              result.passed
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            <div>
              <h4 className="text-lg font-bold flex items-center gap-2">
                {result.passed ? (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    <span>{t(locale, "testing.passed")}!</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6" />
                    <span>{t(locale, "testing.failed")}</span>
                  </>
                )}
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                {result.isTimeExceeded
                  ? "Время тестирования истекло."
                  : `Проходной порог: ${test.passingScorePercent}%`}
              </p>
            </div>

            <div className="text-right">
              <div className="text-3xl font-black">
                {result.scorePercent}%
              </div>
              <div className="text-xs text-slate-400">
                {result.scorePoints} из {result.maxPoints} баллов
              </div>
            </div>
          </div>

          {/* Detailed Question Review */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {t(locale, "testing.reviewTitle")}
            </h4>
            <div className="space-y-3">
              {result.review.map((item, idx) => (
                <div
                  key={item.questionId}
                  className={`p-3.5 rounded-xl border space-y-1.5 text-xs ${
                    item.isCorrect
                      ? "bg-emerald-500/5 border-emerald-500/20 text-slate-300"
                      : "bg-red-500/5 border-red-500/20 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      {idx + 1}. {item.questionText}
                    </span>
                    <span
                      className={`font-bold ${
                        item.isCorrect ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {item.points} / {item.maxPoints} б.
                    </span>
                  </div>

                  <div className="text-xs space-y-0.5 text-slate-400 pt-1">
                    <div>
                      {t(locale, "testing.yourAnswer")}:{" "}
                      <span className="text-white font-mono">
                        {Array.isArray(item.studentAnswer)
                          ? item.studentAnswer.join(", ")
                          : String(item.studentAnswer ?? "—")}
                      </span>
                    </div>
                    {!item.isCorrect && (
                      <div className="text-amber-400">
                        {t(locale, "testing.correctAnswer")}:{" "}
                        <span className="font-mono font-bold">
                          {Array.isArray(item.correctAnswer)
                            ? item.correctAnswer.join(", ")
                            : String(item.correctAnswer ?? "—")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canAttempt && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleStart}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Попробовать снова</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
