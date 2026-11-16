"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CheckCircle2, XCircle, Plus } from "lucide-react";
import { formatDateLocalized } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, StatusDot } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export interface SubstitutionItem {
  id: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string;
  resolverComment?: string | null;
  createdAt: string;
  lesson: {
    id: string;
    title: string;
    scheduledAt?: string | null;
    durationMinutes?: number | null;
    status: string;
    module?: {
      title: string;
      course: { id: string; title: string };
    };
    scheduleSlot?: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      group: { id: string; name: string };
    };
  };
  requester: {
    id: string;
    role: string;
    user: { fullName: string; email: string };
  };
  proposedSubstitute?: {
    id: string;
    role: string;
    user: { fullName: string; email: string };
  } | null;
  substituteTeacher?: {
    id: string;
    role: string;
    user: { fullName: string; email: string };
  } | null;
  resolvedBy?: {
    id: string;
    user: { fullName: string };
  } | null;
}

export interface TeacherOption {
  id: string;
  role: string;
  fullName: string;
  email: string;
}

export interface LessonOption {
  id: string;
  title: string;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
}

interface SubstitutionsManagerProps {
  initialRequests: SubstitutionItem[];
  teachers: TeacherOption[];
  myLessons: LessonOption[];
  role: string;
  currentMembershipId: string;
  locale?: string;
}

export default function SubstitutionsManager({
  initialRequests,
  teachers,
  myLessons,
  role,
  currentMembershipId,
  locale = "ru",
}: SubstitutionsManagerProps) {
  const router = useRouter();
  const isUz = locale === "uz-Latn";
  const [requests, setRequests] = useState<SubstitutionItem[]>(initialRequests);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState(myLessons[0]?.id || "");
  const [reason, setReason] = useState("");
  const [proposedSubstituteId, setProposedSubstituteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const [resolveTarget, setResolveTarget] = useState<{
    request: SubstitutionItem;
    action: "APPROVE" | "REJECT";
  } | null>(null);
  const [assignSubstituteId, setAssignSubstituteId] = useState("");
  const [resolverComment, setResolverComment] = useState("");

  const isPrivileged = role === "DIRECTOR" || role === "CENTER_ADMIN";

  const activeRequests = requests.filter((r) => r.status === "REQUESTED");
  const historyRequests = requests.filter((r) => r.status !== "REQUESTED");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLessonId || !reason.trim()) {
      setErrorMsg(
        isUz ? "Dars va sabab ko'rsatilishi shart" : "Укажите урок и причину"
      );
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/substitutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: selectedLessonId,
          reason: reason.trim(),
          proposedSubstituteMembershipId: proposedSubstituteId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Ошибка создания заявки");
        return;
      }

      setShowCreateModal(false);
      setReason("");
      setProposedSubstituteId("");
      setRequests([data.substitutionRequest, ...requests]);
      router.refresh();
    } catch {
      setErrorMsg(isUz ? "Tarmoq xatosi" : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;

    if (resolveTarget.action === "APPROVE" && !assignSubstituteId) {
      setErrorMsg(
        isUz
          ? "O'rinbosar o'qituvchini tanlang"
          : "Выберите заменяющего преподавателя"
      );
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/substitutions/${resolveTarget.request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: resolveTarget.action,
          substituteTeacherMembershipId: assignSubstituteId || undefined,
          resolverComment: resolverComment.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Ошибка обработки заявки");
        return;
      }

      setResolveTarget(null);
      setAssignSubstituteId("");
      setResolverComment("");
      setRequests(
        requests.map((r) =>
          r.id === data.substitutionRequest.id ? data.substitutionRequest : r
        )
      );
      router.refresh();
    } catch {
      setErrorMsg(isUz ? "Tarmoq xatosi" : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTargetId) return;
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/substitutions/${cancelTargetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });
      const data = await res.json();
      if (res.ok) {
        setRequests(
          requests.map((r) =>
            r.id === cancelTargetId ? data.substitutionRequest : r
          )
        );
        setCancelTargetId(null);
        router.refresh();
      } else {
        setActionError(
          data.error ||
            (isUz ? "Bekor qilib bo'lmadi" : "Не удалось отменить заявку")
        );
        setCancelTargetId(null);
      }
    } catch {
      setActionError(isUz ? "Tarmoq xatosi" : "Ошибка сети");
      setCancelTargetId(null);
    } finally {
      setLoading(false);
    }
  };

  const renderStatus = (st: SubstitutionItem["status"]) => {
    switch (st) {
      case "REQUESTED":
        return <StatusDot tone="warning" label={isUz ? "Kutilmoqda" : "Ожидает"} />;
      case "APPROVED":
        return <StatusDot tone="success" label={isUz ? "Tasdiqlangan" : "Одобрена"} />;
      case "REJECTED":
        return <StatusDot tone="destructive" label={isUz ? "Rad etilgan" : "Отклонена"} />;
      case "CANCELLED":
        return <StatusDot tone="neutral" label={isUz ? "Bekor qilingan" : "Отменена"} />;
    }
  };

  const renderRequestsPanel = (
    tab: "ACTIVE" | "HISTORY",
    items: SubstitutionItem[]
  ) =>
    items.length === 0 ? (
      <EmptyState
        icon={<Calendar className="w-5 h-5" aria-hidden="true" />}
        title={
          tab === "ACTIVE"
            ? isUz
              ? "Hozirda faol so'rovlar yo'q"
              : "Нет активных заявок на замену"
            : isUz
            ? "Tarix bo'sh"
            : "История замен пуста"
        }
        description={
          isUz
            ? "O'qituvchilar darsni o'zgartirish yoki almashtirish uchun ariza yuborishi mumkin."
            : "Преподаватели могут запрашивать замену уроков при болезни или невозможности провести занятие."
        }
      />
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((req) => {
          const isMine = req.requester.id === currentMembershipId;
          return (
            <Card key={req.id} className="flex flex-col justify-between">
              <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-primary block">
                        {req.lesson.module?.course.title || "Курс"}
                      </span>
                      <h3 className="text-sm font-semibold text-foreground mt-0.5">
                        {req.lesson.title}
                      </h3>
                      {req.lesson.scheduledAt && (
                        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                          {formatDateLocalized(new Date(req.lesson.scheduledAt), locale)}{" "}
                          · {req.lesson.durationMinutes || 60} мин
                        </p>
                      )}
                    </div>
                    <div className="shrink-0">{renderStatus(req.status)}</div>
                  </div>

                  <div className="p-3 rounded-md bg-muted/60 border border-border space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {isUz ? "O'qituvchi:" : "Преподаватель:"}
                      </span>
                      <span className="font-semibold text-foreground">
                        {req.requester.user.fullName}
                      </span>
                    </div>

                    {req.proposedSubstitute && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {isUz ? "Taklif etilgan:" : "Предложен:"}
                        </span>
                        <span className="text-warning font-medium">
                          {req.proposedSubstitute.user.fullName}
                        </span>
                      </div>
                    )}

                    {req.substituteTeacher && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {isUz ? "O'rinbosar:" : "Заменяет:"}
                        </span>
                        <span className="font-semibold text-success">
                          {req.substituteTeacher.user.fullName}
                        </span>
                      </div>
                    )}

                    <div className="pt-1.5 border-t border-border">
                      <span className="text-muted-foreground block mb-0.5">
                        {isUz ? "Sabab:" : "Причина:"}
                      </span>
                      <p className="text-foreground/90">«{req.reason}»</p>
                    </div>

                    {req.resolverComment && (
                      <div className="pt-1">
                        <span className="text-muted-foreground block mb-0.5">
                          {isUz ? "Izoh:" : "Комментарий:"}
                        </span>
                        <p className="text-muted-foreground">{req.resolverComment}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDateLocalized(new Date(req.createdAt), locale)}
                  </span>

                  <div className="flex items-center gap-2">
                    {req.status === "REQUESTED" && isMine && !isPrivileged && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelTargetId(req.id)}
                        disabled={loading}
                      >
                        {isUz ? "Bekor qilish" : "Отменить"}
                      </Button>
                    )}

                    {req.status === "REQUESTED" && isPrivileged && (
                      <>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setErrorMsg("");
                            setAssignSubstituteId(
                              req.proposedSubstitute?.id || teachers[0]?.id || ""
                            );
                            setResolverComment("");
                            setResolveTarget({ request: req, action: "APPROVE" });
                          }}
                        >
                          {isUz ? "Tasdiqlash" : "Одобрить"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setErrorMsg("");
                            setResolverComment("");
                            setResolveTarget({ request: req, action: "REJECT" });
                          }}
                        >
                          {isUz ? "Rad etish" : "Отклонить"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title={isUz ? "Dars almashtirishlar" : "Замены преподавателей"}
        description={
          isUz
            ? "Darslarni almashtirish so'rovlari va o'rinbosarlarni tasdiqlash"
            : "Заявки на замену уроков, согласование и назначение замещающих"
        }
        actions={
          role === "TEACHER" || role === "TEACHER_ASSISTANT" || isPrivileged ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setErrorMsg("");
                setShowCreateModal(true);
              }}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{isUz ? "Almashtirish so'rovi" : "Запросить замену"}</span>
            </Button>
          ) : undefined
        }
      />

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "ACTIVE" | "HISTORY")}
      >
        <TabsList>
          <TabsTrigger value="ACTIVE">
            <span>{isUz ? "Faol so'rovlar" : "Активные заявки"}</span>
            {activeRequests.length > 0 && (
              <Badge variant="warning">{activeRequests.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="HISTORY">
            <span>{isUz ? "Tarix" : "История замен"}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ACTIVE">
          {renderRequestsPanel("ACTIVE", activeRequests)}
        </TabsContent>
        <TabsContent value="HISTORY">
          {renderRequestsPanel("HISTORY", historyRequests)}
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent locale={locale} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>
                {isUz ? "Dars almashtirish so'rovi" : "Запрос на замену урока"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sub-lesson">
                {isUz ? "Darsni tanlang" : "Выберите урок"}
              </Label>
              {myLessons.length === 0 ? (
                <Alert variant="warning">
                  <AlertDescription>
                    {isUz
                      ? "Sizda almashtirish uchun darslar topilmadi"
                      : "У вас нет доступных запланированных уроков"}
                  </AlertDescription>
                </Alert>
              ) : (
                <select
                  id="sub-lesson"
                  required
                  value={selectedLessonId}
                  onChange={(e) => setSelectedLessonId(e.target.value)}
                  className={SELECT_CLS}
                >
                  {myLessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title}{" "}
                      {l.scheduledAt
                        ? `(${formatDateLocalized(new Date(l.scheduledAt), locale)})`
                        : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-reason">
                {isUz ? "Almashtirish sababi" : "Причина замены"}
              </Label>
              <Textarea
                id="sub-reason"
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  isUz
                    ? "Masalan: Kasallik tufayli yoki shoshilinch safar..."
                    : "Например: Больничный лист, семейные обстоятельства..."
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sub-proposed">
                {isUz
                  ? "Taklif etilayotgan o'qituvchi (ixtiyoriy)"
                  : "Предпочтительный заменяющий (опционально)"}
              </Label>
              <select
                id="sub-proposed"
                value={proposedSubstituteId}
                onChange={(e) => setProposedSubstituteId(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">
                  {isUz ? "Ma'muriyat o'zi tanlasin" : "На усмотрение директора"}
                </option>
                {teachers
                  .filter((t) => t.id !== currentMembershipId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.role})
                    </option>
                  ))}
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                {isUz ? "Bekor qilish" : "Отмена"}
              </Button>
              <Button
                type="submit"
                loading={loading}
                disabled={myLessons.length === 0}
              >
                {isUz ? "Yuborish" : "Отправить заявку"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resolveTarget)}
        onOpenChange={(open) => {
          if (!open) setResolveTarget(null);
        }}
      >
        <DialogContent locale={locale} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {resolveTarget?.action === "APPROVE" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />
                  <span>
                    {isUz ? "Almashtirishni tasdiqlash" : "Одобрение заявки на замену"}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-destructive" aria-hidden="true" />
                  <span>
                    {isUz ? "Almashtirishni rad etish" : "Отклонение заявки на замену"}
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          {resolveTarget && (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-muted/60 border border-border text-xs space-y-1">
                <span className="text-muted-foreground">{isUz ? "Dars:" : "Урок:"}</span>
                <p className="text-foreground font-semibold">
                  {resolveTarget.request.lesson.title}
                </p>
                <p className="text-muted-foreground">«{resolveTarget.request.reason}»</p>
              </div>

              {resolveTarget.action === "APPROVE" && (
                <div className="space-y-1.5">
                  <Label htmlFor="sub-assign">
                    {isUz
                      ? "O'rinbosar o'qituvchini tayinlang"
                      : "Назначить заменяющего преподавателя"}
                  </Label>
                  <select
                    id="sub-assign"
                    value={assignSubstituteId}
                    onChange={(e) => setAssignSubstituteId(e.target.value)}
                    className={SELECT_CLS}
                  >
                    <option value="">{isUz ? "Tanlang..." : "Выберите..."}</option>
                    {teachers
                      .filter((t) => t.id !== resolveTarget.request.requester.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName} ({t.role})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="sub-comment">
                  {isUz
                    ? "Izoh (ixtiyoriy)"
                    : "Комментарий для преподавателя (опционально)"}
                </Label>
                <Textarea
                  id="sub-comment"
                  rows={2}
                  value={resolverComment}
                  onChange={(e) => setResolverComment(e.target.value)}
                  placeholder={
                    isUz ? "Izoh yozing..." : "Например: Согласовано с директором..."
                  }
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResolveTarget(null)}
                >
                  {isUz ? "Bekor qilish" : "Отмена"}
                </Button>
                <Button
                  type="button"
                  variant={resolveTarget.action === "APPROVE" ? "primary" : "destructive"}
                  onClick={handleResolve}
                  loading={loading}
                >
                  {resolveTarget.action === "APPROVE"
                    ? isUz
                      ? "Tasdiqlash"
                      : "Одобрить замену"
                    : isUz
                    ? "Rad etish"
                    : "Отклонить замену"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(cancelTargetId)}
        onOpenChange={(open) => {
          if (!open) setCancelTargetId(null);
        }}
        locale={locale}
        variant="destructive"
        loading={loading}
        title={isUz ? "Arizani bekor qilish" : "Отменить заявку на замену"}
        description={
          isUz ? "Arizani bekor qilasizmi?" : "Вы действительно хотите отменить эту заявку?"
        }
        confirmLabel={isUz ? "Bekor qilish" : "Отменить заявку"}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
