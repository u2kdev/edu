"use client";

import { useState } from "react";
import {
  FileCheck2,
  Plus,
  Clock,
  Award,
  Users,
  Trash2,
  Play,
  Eye,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormActions, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

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
  const [pageError, setPageError] = useState<string | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
  const [, setLoadingAttempts] = useState(false);

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
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [attemptResult, setAttemptResult] = useState<{
    scorePercent: number;
    passed: boolean;
    review: Array<{
      questionText: string;
      isCorrect: boolean;
      points?: number;
      earnedPoints?: number;
      maxPoints: number;
      studentAnswer: unknown;
      correctAnswer: unknown;
    }>;
  } | null>(null);

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

  const confirmDeleteTest = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    setPageError(null);
    try {
      const res = await fetch(`/api/tests/${deleteTargetId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Ошибка удаления");
      }
      setTests(tests.filter((t) => t.id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (err: unknown) {
      setDeleteTargetId(null);
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setDeleting(false);
    }
  };

  const openAttempts = async (test: TestSummary) => {
    setLoadingAttempts(true);
    setPageError(null);
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
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoadingAttempts(false);
    }
  };

  const startTestPreview = async (test: TestSummary) => {
    setLoadingAttempts(true);
    setPageError(null);
    setAttemptError(null);
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
      setPageError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoadingAttempts(false);
    }
  };

  const handleSubmitAttempt = async () => {
    if (!takingTest) return;
    setSubmittingAttempt(true);
    setAttemptError(null);
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
      setAttemptError(err instanceof Error ? err.message : "Ошибка");
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
      <PageHeader
        title="Тесты и онлайн-проверка"
        description="Создание тестов, автопроверка ответов, выставление оценок в журнал и аналитика"
        actions={
          canManage ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setActionError("");
                setIsCreateOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Создать тест</span>
            </Button>
          ) : undefined
        }
      />

      {pageError && (
        <Alert variant="destructive">
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      )}

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Поиск по названию или описанию теста..."
        hasActiveFilters={Boolean(searchTerm || selectedCourse)}
        onReset={() => {
          setSearchTerm("");
          setSelectedCourse("");
        }}
      >
        <select
          aria-label="Курс"
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className={`${SELECT_CLS} w-48 text-[13px]`}
        >
          <option value="">Все курсы</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </FilterBar>

      {filteredTests.length === 0 ? (
        <EmptyState
          icon={<HelpCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          title="Тесты не найдены"
          description={
            searchTerm || selectedCourse
              ? "Попробуйте изменить параметры поиска"
              : "Создайте первый тест для ваших учеников"
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTests.map((test) => (
            <Card key={test.id} className="flex flex-col justify-between">
              <CardContent className="flex h-full flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground">{test.title}</h3>
                    {canManage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTargetId(test.id)}
                        title="Удалить тест"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                  {test.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {test.description}
                    </p>
                  )}

                  <div className="mt-4 space-y-2 text-xs text-foreground tabular-nums">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Время:
                      </span>
                      <span className="font-medium">
                        {test.timeLimitMinutes ? `${test.timeLimitMinutes} мин.` : "Без ограничения"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Award className="h-3.5 w-3.5" aria-hidden="true" /> Проходной балл:
                      </span>
                      <span className="font-medium">{test.passingScorePercent}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" /> Вопросов:
                      </span>
                      <span className="font-medium">{test.questionsCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" /> Попыток:
                      </span>
                      <span className="font-medium">
                        {test.attemptsCount}{" "}
                        {test.attemptsCount > 0 ? `(ср. ${test.averageScore}%)` : ""}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openAttempts(test)}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {role === "PARENT"
                        ? `Результаты ребёнка (${test.attemptsCount})`
                        : `Попытки (${test.attemptsCount}/${test.maxAttempts})`}
                    </span>
                  </Button>
                  {role === "STUDENT" && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => startTestPreview(test)}
                      disabled={test.attemptsCount >= test.maxAttempts}
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {test.attemptsCount >= test.maxAttempts ? "Лимит исчерпан" : "Пройти тест"}
                      </span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Test Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Новый онлайн-тест</span>
            </DialogTitle>
          </DialogHeader>

          {actionError && (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreateTest} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormField label="Название теста" htmlFor="test-title" required>
                  <Input
                    id="test-title"
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Например: Итоговый тест по Модулю 1"
                  />
                </FormField>
              </div>

              <div className="sm:col-span-2">
                <FormField label="Описание / Инструкция" htmlFor="test-desc">
                  <Textarea
                    id="test-desc"
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Краткие инструкции перед началом тестирования..."
                  />
                </FormField>
              </div>

              <FormField label="Привязать к курсу" htmlFor="test-course">
                <select
                  id="test-course"
                  value={newCourseId}
                  onChange={(e) => setNewCourseId(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">Без привязки</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Привязать к группе" htmlFor="test-group">
                <select
                  id="test-group"
                  value={newGroupId}
                  onChange={(e) => setNewGroupId(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">Все группы курса</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Лимит времени (минут)" htmlFor="test-limit">
                <Input
                  id="test-limit"
                  type="number"
                  min={0}
                  value={newTimeLimit}
                  onChange={(e) =>
                    setNewTimeLimit(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="0 = без лимита"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Проходной %" htmlFor="test-pass">
                  <Input
                    id="test-pass"
                    type="number"
                    min={1}
                    max={100}
                    value={newPassingScore}
                    onChange={(e) => setNewPassingScore(Number(e.target.value))}
                  />
                </FormField>
                <FormField label="Попыток" htmlFor="test-attempts">
                  <Input
                    id="test-attempts"
                    type="number"
                    min={1}
                    max={10}
                    value={newMaxAttempts}
                    onChange={(e) => setNewMaxAttempts(Number(e.target.value))}
                  />
                </FormField>
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  Вопросы ({questions.length})
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Добавить вопрос</span>
                </Button>
              </div>

              {questions.map((q, qIdx) => (
                <div
                  key={qIdx}
                  className="space-y-3 rounded-lg border border-border bg-muted/40 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-primary">
                      Вопрос #{qIdx + 1}
                    </span>
                    {questions.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(qIdx)}
                      >
                        Удалить
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <Input
                      type="text"
                      placeholder="Текст вопроса..."
                      value={q.questionText}
                      onChange={(e) => updateQuestion(qIdx, { questionText: e.target.value })}
                      className="sm:col-span-2"
                    />
                    <select
                      aria-label="Тип вопроса"
                      value={q.questionType}
                      onChange={(e) =>
                        updateQuestion(qIdx, {
                          questionType: e.target.value as NewQuestionInput["questionType"],
                        })
                      }
                      className={SELECT_CLS}
                    >
                      <option value="SINGLE_CHOICE">Один верный</option>
                      <option value="MULTIPLE_CHOICE">Несколько верных</option>
                      <option value="TRUE_FALSE">Да / Нет</option>
                      <option value="TEXT">Текстовый ответ</option>
                    </select>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Баллы"
                      value={q.points}
                      onChange={(e) =>
                        updateQuestion(qIdx, { points: Number(e.target.value) || 1 })
                      }
                    />
                  </div>

                  {(q.questionType === "SINGLE_CHOICE" || q.questionType === "MULTIPLE_CHOICE") && (
                    <div className="space-y-2 pl-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        Варианты ответов:
                      </div>
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
                          <Input
                            type="text"
                            placeholder={`Вариант ${optIdx + 1}`}
                            value={opt.text}
                            onChange={(e) => {
                              const newOpts = [...q.options];
                              newOpts[optIdx].text = e.target.value;
                              updateQuestion(qIdx, { options: newOpts });
                            }}
                            className="h-8 text-xs"
                          />
                          {q.options.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newOpts = q.options.filter((_, i) => i !== optIdx);
                                updateQuestion(qIdx, { options: newOpts });
                              }}
                              title="Удалить вариант"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const newOpts = [...q.options, { text: "", isCorrect: false }];
                          updateQuestion(qIdx, { options: newOpts });
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Добавить вариант</span>
                      </Button>
                    </div>
                  )}

                  {q.questionType === "TRUE_FALSE" && (
                    <div className="flex items-center gap-4 text-xs text-foreground">
                      <span className="text-muted-foreground">Правильный ответ:</span>
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="radio"
                          name={`tf_${qIdx}`}
                          checked={q.correctAnswerText !== "false"}
                          onChange={() => updateQuestion(qIdx, { correctAnswerText: "true" })}
                        />
                        Истина (True)
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5">
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
                    <Input
                      type="text"
                      placeholder="Точный текст правильного ответа..."
                      value={q.correctAnswerText}
                      onChange={(e) =>
                        updateQuestion(qIdx, { correctAnswerText: e.target.value })
                      }
                      className="h-8 text-xs"
                    />
                  )}
                </div>
              ))}
            </div>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Сохранение..." : "Создать тест"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Attempts Dialog */}
      <Dialog
        open={Boolean(viewingAttemptsTest)}
        onOpenChange={(open) => !open && setViewingAttemptsTest(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {viewingAttemptsTest && (
            <>
              <DialogHeader>
                <DialogTitle>Попытки сдачи теста</DialogTitle>
                <p className="text-xs text-muted-foreground">{viewingAttemptsTest.title}</p>
              </DialogHeader>

              {viewingAttemptsTest.attempts.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Пока никто не проходил данный тест
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {viewingAttemptsTest.attempts.map((att) => (
                    <div key={att.id} className="space-y-3 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="font-medium text-foreground">{att.studentName}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {att.completedAt
                              ? new Date(att.completedAt).toLocaleString("ru-RU")
                              : "В процессе сдачи..."}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={att.scorePercent >= 60 ? "success" : "destructive"}>
                            {att.scorePercent}% ({att.scorePoints} / {att.maxPoints} б.)
                          </Badge>
                          {att.review && att.review.length > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExpandedAttemptId(
                                  expandedAttemptId === att.id ? null : att.id
                                )
                              }
                            >
                              {expandedAttemptId === att.id ? "Скрыть разбор" : "Разбор ошибок"}
                            </Button>
                          )}
                        </div>
                      </div>

                      {expandedAttemptId === att.id && att.review && att.review.length > 0 && (
                        <div className="space-y-2 border-l-2 border-border pl-3">
                          {att.review.map((r, rIdx) => (
                            <div
                              key={rIdx}
                              className={`rounded-md border p-2.5 text-xs ${
                                r.isCorrect
                                  ? "border-success/30 bg-success-subtle"
                                  : "border-destructive/30 bg-destructive-subtle"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 font-medium text-foreground">
                                <span>{r.questionText}</span>
                                <span className="tabular-nums">
                                  {r.earnedPoints}/{r.maxPoints} б.
                                </span>
                              </div>
                              <div className="mt-1 text-muted-foreground">
                                Ответ ученика:{" "}
                                <span className="font-semibold text-foreground">
                                  {Array.isArray(r.studentAnswer)
                                    ? r.studentAnswer.join(", ")
                                    : String(r.studentAnswer || "—")}
                                </span>
                              </div>
                              {!r.isCorrect && (
                                <div className="text-success">
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

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewingAttemptsTest(null)}
                >
                  Закрыть
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Taking / Previewing Test Dialog */}
      <Dialog open={Boolean(takingTest)} onOpenChange={(open) => !open && setTakingTest(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {takingTest && (
            <>
              <DialogHeader>
                <DialogTitle>{takingTest.title}</DialogTitle>
                {takingTest.timeLimitMinutes && (
                  <p className="flex items-center gap-1 text-xs text-warning tabular-nums">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Лимит: {takingTest.timeLimitMinutes} мин.</span>
                  </p>
                )}
              </DialogHeader>

              {attemptError && (
                <Alert variant="destructive">
                  <AlertDescription>{attemptError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {attemptResult ? (
                  <div className="space-y-4">
                    <Alert variant={attemptResult.passed ? "success" : "destructive"}>
                      <AlertDescription className="text-center">
                        <div className="mb-1 text-2xl font-bold tabular-nums">
                          {attemptResult.scorePercent}%
                        </div>
                        <div className="text-sm font-semibold">
                          {attemptResult.passed ? "Тест успешно сдан" : "Тест не сдан"}
                        </div>
                        <div className="mt-1 text-xs opacity-90">
                          Результат автоматически зафиксирован в журнале успеваемости
                        </div>
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2.5">
                      <h3 className="text-xs font-semibold text-muted-foreground">
                        Разбор вопросов:
                      </h3>
                      {attemptResult.review.map((item, idx) => (
                        <div
                          key={idx}
                          className={`rounded-md border p-3 text-xs ${
                            item.isCorrect
                              ? "border-success/30 bg-success-subtle text-foreground"
                              : "border-destructive/30 bg-destructive-subtle text-foreground"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold">{item.questionText}</span>
                            {item.isCorrect ? (
                              <CheckCircle2
                                className="h-4 w-4 shrink-0 text-success"
                                aria-hidden="true"
                              />
                            ) : (
                              <XCircle
                                className="h-4 w-4 shrink-0 text-destructive"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className="mt-2 space-y-1 text-muted-foreground">
                            <div>
                              Ваш ответ:{" "}
                              <span className="font-medium text-foreground">
                                {Array.isArray(item.studentAnswer)
                                  ? item.studentAnswer.join(", ")
                                  : String(item.studentAnswer || "—")}
                              </span>
                            </div>
                            {!item.isCorrect && (
                              <div>
                                Правильный ответ:{" "}
                                <span className="font-medium text-success">
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
                      } catch {
                        options = [];
                      }
                    }

                    return (
                      <div
                        key={q.id}
                        className="space-y-3 rounded-lg border border-border bg-muted/40 p-4"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground tabular-nums">
                          <span>Вопрос {idx + 1}</span>
                          <span>{q.points} б.</span>
                        </div>
                        <p className="text-sm font-medium text-foreground">{q.questionText}</p>

                        {q.questionType === "SINGLE_CHOICE" && (
                          <div className="space-y-2 pt-1">
                            {options.map((opt, oIdx) => (
                              <label
                                key={oIdx}
                                className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-card p-2 text-sm hover:border-primary/50"
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
                                  className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-card p-2 text-sm hover:border-primary/50"
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
                                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-card p-2.5 text-sm font-medium hover:border-primary/50"
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
                            <Input
                              type="text"
                              placeholder="Ваш ответ..."
                              value={
                                typeof studentAnswers[q.id] === "string"
                                  ? (studentAnswers[q.id] as string)
                                  : ""
                              }
                              onChange={(e) =>
                                setStudentAnswers({
                                  ...studentAnswers,
                                  [q.id]: e.target.value,
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <DialogFooter>
                {attemptResult ? (
                  <Button type="button" onClick={() => setTakingTest(null)}>
                    Закрыть
                  </Button>
                ) : (
                  <>
                    <Button type="button" variant="outline" onClick={() => setTakingTest(null)}>
                      Отмена
                    </Button>
                    <Button
                      type="button"
                      disabled={submittingAttempt}
                      onClick={handleSubmitAttempt}
                    >
                      {submittingAttempt ? "Отправка..." : "Завершить тест"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Удалить тест"
        description="Удалить этот тест и все попытки прохождения?"
        confirmLabel="Удалить"
        variant="destructive"
        loading={deleting}
        onConfirm={confirmDeleteTest}
      />
    </div>
  );
}
