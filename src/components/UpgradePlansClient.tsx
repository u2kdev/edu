"use client";

import { useState } from "react";
import {
  Check,
  X,
  Send,
  Users,
  GraduationCap,
  BookOpen,
  Building,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import {
  PLAN_FEATURE_KEYS,
  PLAN_FEATURE_LABELS,
  type PlanFeatures,
} from "@/lib/plan-features";

export interface UpgradePlanCardItem {
  id: string;
  name: string;
  priceMonthly: number;
  maxStudents: number;
  maxTeachers: number;
  maxCourses: number;
  maxBranches: number;
  maxStorage: number;
  features: PlanFeatures;
}

export interface UpgradeTicketItem {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

interface Props {
  currentPlanId: string | null;
  currentPlanName: string | null;
  subscriptionStatus: string | null;
  plans: UpgradePlanCardItem[];
  initialRequests: UpgradeTicketItem[];
  canRequest: boolean;
  locale?: string;
}

export default function UpgradePlansClient({
  currentPlanId,
  currentPlanName,
  subscriptionStatus,
  plans,
  initialRequests,
  canRequest,
  locale = "ru",
}: Props) {
  const isUz = locale === "uz-Latn";
  const [comment, setComment] = useState("");
  const [requests, setRequests] = useState<UpgradeTicketItem[]>(initialRequests);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleRequestUpgrade = async (planId: string) => {
    setFeedback(null);
    setSubmittingId(planId);
    try {
      const res = await fetch("/api/center/upgrade-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedPlanId: planId,
          comment: comment.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: json.error || "Ошибка отправки запроса",
        });
        return;
      }
      setRequests((prev) => [json.ticket, ...prev]);
      setComment("");
      setFeedback({
        type: "success",
        text: isUz
          ? `So'rov yuborildi (${json.requestedPlan?.name}). Platforma ma'muri tez orada bog'lanadi.`
          : `Запрос на тариф «${json.requestedPlan?.name}» отправлен администратору платформы.`,
      });
    } catch {
      setFeedback({ type: "error", text: "Ошибка сети" });
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={isUz ? "Tariflar va imkoniyatlar" : "Тарифные планы и апгрейд"}
        description={
          isUz
            ? "Joriy tarif imkoniyatlarini solishtiring va kengaytirish uchun so'rov yuboring"
            : "Сравнение возможностей тарифов платформы и заявка на переход на более высокий тариф"
        }
        actions={
          <div className="rounded-md border border-border bg-card px-3.5 py-2 text-[13px] flex items-center gap-2">
            <span className="text-muted-foreground">
              {isUz ? "Joriy tarif:" : "Текущий тариф:"}
            </span>
            <strong className="text-foreground">
              {currentPlanName || "—"}
            </strong>
            {subscriptionStatus && (
              <Badge variant="primary">{subscriptionStatus}</Badge>
            )}
          </div>
        }
      />

      {feedback && (
        <Alert
          variant={feedback.type === "success" ? "success" : "destructive"}
        >
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      )}

      {canRequest && (
        <Card>
          <CardContent className="p-4 space-y-1.5">
            <Label htmlFor="upgrade-comment">
              {isUz
                ? "So'rovga izoh (ixtiyoriy)"
                : "Комментарий к заявке (опционально)"}
            </Label>
            <Input
              id="upgrade-comment"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isUz
                  ? "Masalan: Click va ommaviy SMS-xabarnomalarni ulash kerak"
                  : "Например: хотим подключить онлайн-оплату Click и массовые рассылки"
              }
            />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          return (
            <Card
              key={plan.id}
              className={cn(
                "flex flex-col justify-between",
                isCurrent && "border-primary ring-1 ring-primary/30"
              )}
            >
              <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-foreground">
                      {plan.name}
                    </h2>
                    {isCurrent && (
                      <Badge variant="primary">
                        {isUz ? "Faol" : "Текущий"}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-foreground tabular-nums">
                      {Math.round(plan.priceMonthly).toLocaleString("ru-RU")}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
                      UZS / мес
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border space-y-2 text-xs text-foreground">
                    <div className="flex items-center gap-2">
                      <Users
                        className="w-3.5 h-3.5 text-primary shrink-0"
                        aria-hidden="true"
                      />
                      <span className="tabular-nums">
                        {isUz ? "O'quvchilar:" : "Учеников:"}{" "}
                        <strong>{plan.maxStudents}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap
                        className="w-3.5 h-3.5 text-primary shrink-0"
                        aria-hidden="true"
                      />
                      <span className="tabular-nums">
                        {isUz ? "O'qituvchilar:" : "Учителей:"}{" "}
                        <strong>{plan.maxTeachers}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen
                        className="w-3.5 h-3.5 text-success shrink-0"
                        aria-hidden="true"
                      />
                      <span className="tabular-nums">
                        {isUz ? "Kurslar:" : "Курсов:"}{" "}
                        <strong>{plan.maxCourses}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building
                        className="w-3.5 h-3.5 text-warning shrink-0"
                        aria-hidden="true"
                      />
                      <span className="tabular-nums">
                        {isUz ? "Filiallar:" : "Филиалов:"}{" "}
                        <strong>{plan.maxBranches}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    {PLAN_FEATURE_KEYS.map((key) => {
                      const enabled = plan.features[key];
                      const label = isUz
                        ? PLAN_FEATURE_LABELS[key].uz
                        : PLAN_FEATURE_LABELS[key].ru;
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-2 text-xs"
                        >
                          {enabled ? (
                            <Check
                              className="w-4 h-4 text-success shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <X
                              className="w-4 h-4 text-muted-foreground/50 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                          <span
                            className={
                              enabled
                                ? "text-foreground"
                                : "text-muted-foreground line-through"
                            }
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant={isCurrent ? "secondary" : "primary"}
                    disabled={
                      isCurrent || !canRequest || submittingId === plan.id
                    }
                    loading={submittingId === plan.id}
                    onClick={() => handleRequestUpgrade(plan.id)}
                    className="w-full"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {isCurrent
                        ? isUz
                          ? "Sizning joriy tarifingiz"
                          : "Выбран сейчас"
                        : isUz
                        ? "Tarifni so'rash"
                        : "Запросить смену тарифа"}
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {requests.length > 0 && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              {isUz
                ? "Yuborilgan so'rovlar"
                : "Отправленные заявки на смену тарифа"}
            </h2>
            <div className="divide-y divide-border">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm py-2.5 first:pt-0 last:pb-0"
                >
                  <div>
                    <span className="font-medium text-foreground">
                      {r.subject}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2 tabular-nums">
                      {new Date(r.createdAt).toLocaleString("ru-RU")}
                    </span>
                  </div>
                  <Badge variant="neutral">{r.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
