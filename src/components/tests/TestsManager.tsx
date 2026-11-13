"use client";

import { useState } from "react";
import {
  FileCheck2,
  Plus,
  Search,
  Clock,
  Award,
  Users,
  Trash2,
  Play,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

export interface TestSummary {
  id: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number | null;
  passingScorePercent: number;
  maxAttempts: number;
  questionsCount: number;
  totalPoints: number;
  courseTitle?: string | null;
  groupName?: string | null;
  courseId?: string | null;
  groupId?: string | null;
  attemptsCount: number;
  averageScore: number;
  createdAt: string;
}

interface NewQuestionInput {
  questionText: string;
  questionType: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "TEXT";
  points: number;
  options: Array<{ text: string; isCorrect: boolean }>;
  correctAnswerText: string;
}

interface TestsManagerProps {
  initialTests: TestSummary[];
  courses: Array<{ id: string; title: string }>;
  groups: Array<{ id: string; name: string }>;
  canManage: boolean;
  role?: string;
}

export default function TestsManager({
  initialTests,
  courses,
  groups,
  canManage,
  role = "",
}: TestsManagerProps) {
  const [tests, setTests] = useState<TestSummary[]>(initialTests);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");

  // Create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCourseId, setNewCourseId] = useState("");
  const [newGroupId, setNewGroupId] = useState("");
  const [newTimeLimit, setNewTimeLimit] = useState<number | "">(30);
  const [newPassingScore, setNewPassingScore] = useState<number>(70);
  const [newMaxAttempts, setNewMaxAttempts] = useState<number>(3);
  const [questions, setQuestions] = useState<NewQuestionInput[]>([
    {
      questionText: "",
      questionType: "SINGLE_CHOICE",
      points: 10,
      options: [
        { text: "", isCorrect: true },
        { text: "", isCorrect: false },
      ],
      correctAnswerText: "",
    },
  ]);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  // View attempts state
  const [viewingAttemptsTest, setViewingAttemptsTest] = useState<{
    id: string;
    title: string;
    attempts: Array<{
      id: string;
      studentName: string;
      scorePercent: number;
      scorePoints: number;
      maxPoints: number;
      completedAt: string | null;
      startedAt: string;
      review?: Array<{
        questionText: string;
        isCorrect: boolean;
        earnedPoints: number;
        maxPoints: number;
        studentAnswer: unknown;
        correctAnswer: unknown;
      }>;
    }>;
  } | null>(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [loadingAttempts, setLoadingAttempts] = useState(false);

  // Take / Preview test state
  const [takingTest, setTakingTest] = useState<{
    id: string;
    title: string;
    timeLimitMinutes: number | null;
    questions: Array<{
      id: string;
      questionText: string;
      questionType: string;
      points: number;
      optionsJson?: string | null;
    }>;
  } | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, unknown>>({});
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [attemptResult, setAttemptResult] = useState<{
    scorePercent: number;
    passed: boolean;
    review: Array<{
      questionText: string;
      isCorrect: boolean;
      points: number;
      maxPoints: number;
      studentAnswer: unknown;
      correctAnswer: unknown;
    }>;
  } | null>(null);

  // Question helpers
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        questionText: "",
        questionType: "SINGLE_CHOICE",
        points: 10,
        options: [
          { text: "", isCorrect: true },
          { text: "", isCorrect: false },
        ],
        correctAnswerText: "",
      },
    ]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx: number, patch: Partial<NewQuestionInput>) => {
    const next = [...questions];
    next[idx] = { ...next[idx], ...patch };
    setQuestions(next);
  };

  const handleCreateTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setActionError("Укажите название теста");
      return;
    }
    if (questions.length === 0) {
      setActionError("Добавьте хотя бы один вопрос");
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].questionText.trim()) {
        setActionError(`Вопрос #${i + 1} не содержит текста`);
        return;
      }
    }

    setSaving(true);
    setActionError("");

    try {
      const formattedQuestions = questions.map((q, idx) => {
        let optionsJson = null;
        let correctAnswer = null;

        if (q.questionType === "SINGLE_CHOICE" || q.questionType === "MULTIPLE_CHOICE") {
          optionsJson = JSON.stringify(q.options);
        } else if (q.questionType === "TRUE_FALSE") {
          correctAnswer = q.correctAnswerText || "true";
        } else if (q.questionType === "TEXT") {
          correctAnswer = q.correctAnswerText;
        }

        return {
          questionText: q.questionText,
          questionType: q.questionType,
          points: Number(q.points) || 1,
          orderIndex: idx,
          optionsJson,
          correctAnswer,
        };
      });

      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          courseId: newCourseId || null,
          groupId: newGroupId || null,
          timeLimitMinutes: newTimeLimit ? Number(newTimeLimit) : null,
          passingScorePercent: Number(newPassingScore),
          maxAttempts: Number(newMaxAttempts),
          questions: formattedQuestions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось создать тест");
      }

      setTests([
        {
          id: data.test.id,
          title: data.test.title,
          description: data.test.description,
          timeLimitMinutes: data.test.timeLimitMinutes,
          passingScorePercent: data.test.passingScorePercent,
          maxAttempts: data.test.maxAttempts,
          questionsCount: formattedQuestions.length,
          totalPoints: formattedQuestions.reduce((acc, q) => acc + q.points, 0),
          courseTitle: courses.find((c) => c.id === newCourseId)?.title || null,
          groupName: groups.find((g) => g.id === newGroupId)?.name || null,
          courseId: newCourseId || null,
          groupId: newGroupId || null,
          attemptsCount: 0,
          averageScore: 0,
          createdAt: new Date().toISOString(),
        },
        ...tests,
      ]);

      setIsCreateOpen(false);
      setNewTitle("");
      setNewDesc("");
      setQuestions([
        {
          questionText: "",
          questionType: "SINGLE_CHOICE",
          points: 10,
          options: [
            { text: "", isCorrect: true },
            { text: "", isCorrect: false },
          ],
          correctAnswerText: "",
        },
      ]);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Ошибка при сохранении теста");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTest = async (testId: string) => {
    if (!confirm("Удалить этот тест и все попытки прохождения?")) return;
    try {
      const res = await fetch(`/api/tests/${testId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Ошибка удаления");
      }
      setTests(tests.filter((t) => t.id !== testId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  const openAttempts = async (test: TestSummary) => {
    setLoadingAttempts(true);
    try {
      const res = await fetch(`/api/tests/${test.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить попытки");

      interface AttemptDto {
        id: string;
        studentName?: string;
        studentMembership?: { user?: { name?: string } };
        scorePercent: number;
        scorePoints: number;
        maxPoints: number;
        completedAt: string | null;
        startedAt: string;
        review?: Array<{
          questionText: string;
          isCorrect: boolean;
          earnedPoints: number;
          maxPoints: number;
          studentAnswer: unknown;
          correctAnswer: unknown;
        }>;
      }
      const attempts = (data.test.attempts || []).map((att: AttemptDto) => ({
        id: att.id,
        studentName: att.studentName || att.studentMembership?.user?.name || "Ученик",
        scorePercent: att.scorePercent ?? 0,
        scorePoints: att.scorePoints ?? 0,
        maxPoints: att.maxPoints ?? 0,
        completedAt: att.completedAt,
        startedAt: att.startedAt,
        review: att.review || [],
      }));

      setExpandedAttemptId(attempts[0]?.id || null);
      setViewingAttemptsTest({
        id: test.id,
        title: test.title,
        attempts,
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoadingAttempts(false);
    }
  };

  const startTestPreview = async (test: TestSummary) => {
    setLoadingAttempts(true);
    setAttemptResult(null);
    setStudentAnswers({});
    try {
      const res = await fetch(`/api/tests/${test.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось открыть тест");

      setTakingTest({
        id: test.id,
        title: test.title,
        timeLimitMinutes: test.timeLimitMinutes,
        questions: data.test.questions || [],
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleSubmitAttempt = async () => {
    if (!takingTest) return;
    setSubmittingAttempt(true);
    try {
      const res = await fetch("/api/tests/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: takingTest.id,
          studentAnswers,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отправки теста");

      setAttemptResult({
        scorePercent: data.attempt?.scorePercent ?? 0,
        passed: data.passed,
        review: data.review || [],
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmittingAttempt(false);
    }
  };

  const filteredTests = tests.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCourse = selectedCourse ? t.courseId === selectedCourse : true;
    return matchesSearch && matchesCourse;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck2 className="w-7 h-7 text-indigo-600" />
            Тесты и онлайн-проверка
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Создание тестов, автопроверка ответов, выставление оценок в журнал и аналитика
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Создать тест
          </button>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по названию или описанию теста..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Все курсы</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {/* Tests Grid */}
      {filteredTests.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-medium text-slate-900 dark:text-white">Тесты не найдены</h3>
          <p className="text-sm text-slate-500 mt-1">
            {searchTerm || selectedCourse
              ? "Попробуйте изменить параметры поиска"
              : "Создайте первый тест для ваших студентов"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTests.map((test) => (
            <div
              key={test.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-base">
                    {test.title}
                  </h3>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteTest(test.id)}
                      className="text-slate-400 hover:text-red-500 p-1 rounded"
                      title="Удалить тест"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {test.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {test.description}
                  </p>
                )}

                <div className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-3.5 h-3.5" /> Время:
                    </span>
                    <span className="font-medium">
                      {test.timeLimitMinutes ? `${test.timeLimitMinutes} мин.` : "Без ограничения"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Award className="w-3.5 h-3.5" /> Проходной балл:
                    </span>
                    <span className="font-medium">{test.passingScorePercent}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <FileCheck2 className="w-3.5 h-3.5" /> Вопросов:
                    </span>
                    <span className="font-medium">{test.questionsCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Users className="w-3.5 h-3.5" /> Попыток:
                    </span>
                    <span className="font-medium">
                      {test.attemptsCount} {test.attemptsCount > 0 ? `(ср. ${test.averageScore}%)` : ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
                <button
                  onClick={() => openAttempts(test)}
                  className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600 font-medium py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {role === "PARENT"
                    ? `Результаты ребёнка (${test.attemptsCount})`
                    : `Попытки (${test.attemptsCount}/${test.maxAttempts})`}
                </button>
                {role === "STUDENT" && (
                  <button
                    onClick={() => startTestPreview(test)}
                    disabled={test.attemptsCount >= test.maxAttempts}
                    className="flex items-center gap-1 text-xs bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 disabled:opacity-50 font-medium py-1.5 px-3 rounded-lg transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {test.attemptsCount >= test.maxAttempts
                      ? "Лимит исчерпан"
                      : "Пройти тест"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Create Test */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col my-8">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Новый онлайн-тест
              </h2>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTest} className="flex-1 overflow-y-auto p-5 space-y-5">
              {actionError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {actionError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Название теста *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Например: Итоговый тест по Модулю 1"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Описание / Инструкция
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Краткие инструкции перед началом тестирования..."
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Привязать к курсу
                  </label>
                  <select
                    value={newCourseId}
                    onChange={(e) => setNewCourseId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Без привязки</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Привязать к группе
                  </label>
                  <select
                    value={newGroupId}
                    onChange={(e) => setNewGroupId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Все группы курса</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                    Лимит времени (минут)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newTimeLimit}
                    onChange={(e) =>
                      setNewTimeLimit(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    placeholder="0 = без лимита"
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      Проходной %
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newPassingScore}
                      onChange={(e) => setNewPassingScore(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                      Попыток
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newMaxAttempts}
                      onChange={(e) => setNewMaxAttempts(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Questions Section */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                    Вопросы ({questions.length})
                  </h3>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Добавить вопрос
                  </button>
                </div>

                {questions.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase">
                        Вопрос #{qIdx + 1}
                      </span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qIdx)}
                          className="text-slate-400 hover:text-red-500 text-xs"
                        >
                          Удалить
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="Текст вопроса..."
                        value={q.questionText}
                        onChange={(e) => updateQuestion(qIdx, { questionText: e.target.value })}
                        className="sm:col-span-2 px-3 py-1.5 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      />
                      <select
                        value={q.questionType}
                        onChange={(e) =>
                          updateQuestion(qIdx, {
                            questionType: e.target.value as NewQuestionInput["questionType"],
                          })
                        }
                        className="px-2 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      >
                        <option value="SINGLE_CHOICE">Один верный</option>
                        <option value="MULTIPLE_CHOICE">Несколько верных</option>
                        <option value="TRUE_FALSE">Да / Нет</option>
                        <option value="TEXT">Текстовый ответ</option>
                      </select>
                      <input
                        type="number"
                        min={1}
                        placeholder="Баллы"
                        value={q.points}
                        onChange={(e) =>
                          updateQuestion(qIdx, { points: Number(e.target.value) || 1 })
                        }
                        className="px-2 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    {/* Options or Answer Input */}
                    {(q.questionType === "SINGLE_CHOICE" || q.questionType === "MULTIPLE_CHOICE") && (
                      <div className="space-y-2 pl-2">
                        <div className="text-xs text-slate-500 font-medium">Варианты ответов:</div>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type={q.questionType === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                              name={`correct_${qIdx}`}
                              checked={opt.isCorrect}
                              onChange={(e) => {
                                const newOpts = [...q.options];
                                if (q.questionType === "SINGLE_CHOICE") {
                                  newOpts.forEach((o, i) => (o.isCorrect = i === optIdx));
                                } else {
                                  newOpts[optIdx].isCorrect = e.target.checked;
                                }
                                updateQuestion(qIdx, { options: newOpts });
                              }}
                            />
                            <input
                              type="text"
                              placeholder={`Вариант ${optIdx + 1}`}
                              value={opt.text}
                              onChange={(e) => {
                                const newOpts = [...q.options];
                                newOpts[optIdx].text = e.target.value;
                                updateQuestion(qIdx, { options: newOpts });
                              }}
                              className="flex-1 px-2.5 py-1 text-xs border rounded bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newOpts = q.options.filter((_, i) => i !== optIdx);
                                  updateQuestion(qIdx, { options: newOpts });
                                }}
                                className="text-slate-400 hover:text-red-500 text-xs px-1"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = [...q.options, { text: "", isCorrect: false }];
                            updateQuestion(qIdx, { options: newOpts });
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 mt-1"
                        >
                          + Добавить вариант
                        </button>
                      </div>
                    )}

                    {q.questionType === "TRUE_FALSE" && (
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-500">Правильный ответ:</span>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`tf_${qIdx}`}
                            checked={q.correctAnswerText !== "false"}
                            onChange={() => updateQuestion(qIdx, { correctAnswerText: "true" })}
                          />
                          Истина (True)
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`tf_${qIdx}`}
                            checked={q.correctAnswerText === "false"}
                            onChange={() => updateQuestion(qIdx, { correctAnswerText: "false" })}
                          />
                          Ложь (False)
                        </label>
                      </div>
                    )}

                    {q.questionType === "TEXT" && (
                      <div>
                        <input
                          type="text"
                          placeholder="Точный текст правильного ответа..."
                          value={q.correctAnswerText}
                          onChange={(e) =>
                            updateQuestion(qIdx, { correctAnswerText: e.target.value })
                          }
                          className="w-full px-2.5 py-1 text-xs border rounded bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 border rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                >
                  {saving ? "Сохранение..." : "Создать тест"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Attempts */}
      {viewingAttemptsTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Попытки сдачи теста
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{viewingAttemptsTest.title}</p>
              </div>
              <button
                onClick={() => setViewingAttemptsTest(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {viewingAttemptsTest.attempts.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-500">
                  Пока никто не проходил данный тест
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {viewingAttemptsTest.attempts.map((att) => (
                    <div key={att.id} className="py-3 space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {att.studentName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {att.completedAt
                              ? new Date(att.completedAt).toLocaleString("ru-RU")
                              : "В процессе сдачи..."}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              att.scorePercent >= 60
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            }`}
                          >
                            {att.scorePercent}% ({att.scorePoints} / {att.maxPoints} б.)
                          </span>
                          {att.review && att.review.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedAttemptId(
                                  expandedAttemptId === att.id ? null : att.id
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            >
                              {expandedAttemptId === att.id
                                ? "Скрыть разбор"
                                : "Разбор ошибок"}
                            </button>
                          )}
                        </div>
                      </div>

                      {expandedAttemptId === att.id &&
                        att.review &&
                        att.review.length > 0 && (
                          <div className="space-y-2 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                            {att.review.map((r, rIdx) => (
                              <div
                                key={rIdx}
                                className={`p-2.5 rounded-lg border text-xs ${
                                  r.isCorrect
                                    ? "border-green-200 dark:border-green-900/50 bg-green-50/40 dark:bg-green-950/20"
                                    : "border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 font-medium text-slate-900 dark:text-white">
                                  <span>{r.questionText}</span>
                                  <span>
                                    {r.earnedPoints}/{r.maxPoints} б.
                                  </span>
                                </div>
                                <div className="mt-1 text-slate-600 dark:text-slate-400">
                                  Ответ ученика:{" "}
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {Array.isArray(r.studentAnswer)
                                      ? r.studentAnswer.join(", ")
                                      : String(r.studentAnswer || "—")}
                                  </span>
                                </div>
                                {!r.isCorrect && (
                                  <div className="text-green-700 dark:text-green-400">
                                    Правильный ответ:{" "}
                                    <span className="font-semibold">
                                      {Array.isArray(r.correctAnswer)
                                        ? r.correctAnswer.join(", ")
                                        : String(r.correctAnswer || "—")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Taking / Previewing Test */}
      {takingTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {takingTest.title}
                </h2>
                {takingTest.timeLimitMinutes && (
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5" /> Лимит: {takingTest.timeLimitMinutes} мин.
                  </span>
                )}
              </div>
              <button
                onClick={() => setTakingTest(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-6">
              {attemptResult ? (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-xl text-center ${
                      attemptResult.passed
                        ? "bg-green-50 dark:bg-green-950/30 border border-green-200 text-green-800 dark:text-green-300"
                        : "bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-800 dark:text-red-300"
                    }`}
                  >
                    <div className="text-2xl font-black mb-1">{attemptResult.scorePercent}%</div>
                    <div className="font-semibold text-sm">
                      {attemptResult.passed ? "Тест успешно сдан!" : "Тест не сдан"}
                    </div>
                    <div className="text-xs mt-1 opacity-80">
                      Результат автоматически зафиксирован в журнале успеваемости
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase text-slate-500">
                      Разбор вопросов:
                    </h3>
                    {attemptResult.review.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border text-xs ${
                          item.isCorrect
                            ? "border-green-200 bg-green-50/50 dark:bg-green-950/10 text-slate-800 dark:text-slate-200"
                            : "border-red-200 bg-red-50/50 dark:bg-red-950/10 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold">{item.questionText}</span>
                          {item.isCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                          )}
                        </div>
                        <div className="mt-2 text-slate-600 dark:text-slate-400 space-y-1">
                          <div>
                            Ваш ответ:{" "}
                            <span className="font-medium text-slate-900 dark:text-white">
                              {Array.isArray(item.studentAnswer)
                                ? item.studentAnswer.join(", ")
                                : String(item.studentAnswer || "—")}
                            </span>
                          </div>
                          {!item.isCorrect && (
                            <div>
                              Правильный ответ:{" "}
                              <span className="font-medium text-green-700 dark:text-green-400">
                                {Array.isArray(item.correctAnswer)
                                  ? item.correctAnswer.join(", ")
                                  : String(item.correctAnswer || "—")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                takingTest.questions.map((q, idx) => {
                  let options: Array<{ text: string }> = [];
                  if (q.optionsJson) {
                    try {
                      options = JSON.parse(q.optionsJson);
                    } catch {}
                  }

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                        <span>Вопрос {idx + 1}</span>
                        <span>{q.points} б.</span>
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white text-sm">
                        {q.questionText}
                      </p>

                      {q.questionType === "SINGLE_CHOICE" && (
                        <div className="space-y-2 pt-1">
                          {options.map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:border-indigo-400 text-sm"
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                value={opt.text}
                                checked={studentAnswers[q.id] === opt.text}
                                onChange={(e) =>
                                  setStudentAnswers({
                                    ...studentAnswers,
                                    [q.id]: e.target.value,
                                  })
                                }
                              />
                              <span>{opt.text}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.questionType === "MULTIPLE_CHOICE" && (
                        <div className="space-y-2 pt-1">
                          {options.map((opt, oIdx) => {
                            const curList: string[] = Array.isArray(studentAnswers[q.id])
                              ? (studentAnswers[q.id] as string[])
                              : [];
                            const checked = curList.includes(opt.text);
                            return (
                              <label
                                key={oIdx}
                                className="flex items-center gap-2.5 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer hover:border-indigo-400 text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...curList, opt.text]
                                      : curList.filter((x) => x !== opt.text);
                                    setStudentAnswers({
                                      ...studentAnswers,
                                      [q.id]: next,
                                    });
                                  }}
                                />
                                <span>{opt.text}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {q.questionType === "TRUE_FALSE" && (
                        <div className="flex gap-4 pt-1">
                          {["true", "false"].map((val) => (
                            <label
                              key={val}
                              className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 cursor-pointer text-sm font-medium hover:border-indigo-400"
                            >
                              <input
                                type="radio"
                                name={`q_${q.id}`}
                                value={val}
                                checked={studentAnswers[q.id] === val}
                                onChange={(e) =>
                                  setStudentAnswers({
                                    ...studentAnswers,
                                    [q.id]: e.target.value,
                                  })
                                }
                              />
                              <span>{val === "true" ? "Истина (Да)" : "Ложь (Нет)"}</span>
                            </label>
                          ))}
                        </div>
                      )}

                      {q.questionType === "TEXT" && (
                        <div className="pt-1">
                          <input
                            type="text"
                            placeholder="Ваш ответ..."
                            value={typeof studentAnswers[q.id] === "string" ? (studentAnswers[q.id] as string) : ""}
                            onChange={(e) =>
                              setStudentAnswers({
                                ...studentAnswers,
                                [q.id]: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
              {attemptResult ? (
                <button
                  type="button"
                  onClick={() => setTakingTest(null)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                >
                  Закрыть
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setTakingTest(null)}
                    className="px-4 py-2 border rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={submittingAttempt}
                    onClick={handleSubmitAttempt}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition"
                  >
                    {submittingAttempt ? "Отправка..." : "Завершить тест"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
