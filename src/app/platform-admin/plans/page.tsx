"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BookOpen, Building, Check, CreditCard, Edit2, GraduationCap, HardDrive, Plus, Users, X } from "lucide-react";
import {
  PLAN_FEATURE_KEYS,
  PLAN_FEATURE_LABELS,
  PLAN_PRESETS,
  parsePlanFeatures,
  type PlanFeatures,
} from "@/lib/plan-features";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormActions,
  FormField,
  Input,
  PageHeader,
  Skeleton,
} from "@/components/ui";

interface SubscriptionPlanItem {
  id: string;
  name: string;
  priceMonthly: number;
  maxStudents: number;
  maxTeachers: number;
  maxCourses: number;
  maxBranches: number;
  maxStorage: number;
  featuresJson?: string | null;
  features?: PlanFeatures;
  isActive: boolean;
  _count?: { subscriptions: number };
}

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    priceMonthly: 0,
    maxStudents: 100,
    maxTeachers: 10,
    maxCourses: 20,
    maxBranches: 1,
    maxStorage: 5120,
    isActive: true,
  });
  const [formFeatures, setFormFeatures] = useState<PlanFeatures>({ ...PLAN_PRESETS.pro });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/plans");
      if (!res.ok) throw new Error("Не удалось загрузить тарифные планы");
      const json = await res.json();
      setPlans(json.plans || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setSaveError(null);
    setFormData({
      name: "",
      priceMonthly: 500000,
      maxStudents: 100,
      maxTeachers: 10,
      maxCourses: 20,
      maxBranches: 1,
      maxStorage: 5120,
      isActive: true,
    });
    setFormFeatures({ ...PLAN_PRESETS.pro });
    setModalOpen(true);
  };

  const openEditModal = (plan: SubscriptionPlanItem) => {
    setEditingPlan(plan);
    setSaveError(null);
    setFormData({
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      maxStudents: plan.maxStudents,
      maxTeachers: plan.maxTeachers,
      maxCourses: plan.maxCourses,
      maxBranches: plan.maxBranches,
      maxStorage: plan.maxStorage,
      isActive: plan.isActive,
    });
    setFormFeatures(plan.features ?? parsePlanFeatures(plan.featuresJson));
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      const url = "/api/platform/plans";
      const method = editingPlan ? "PATCH" : "POST";
      const payload = { ...formData, features: formFeatures };
      const body = editingPlan ? { ...payload, id: editingPlan.id } : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Не удалось сохранить тариф");
      }

      setModalOpen(false);
      fetchPlans();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Тарифные планы"
        description="Настройка подписок, ценообразования и системных лимитов для учебных центров"
        actions={
          <Button type="button" variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Создать тариф</span>
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Загрузка тарифных планов...</p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-80 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
          title="Тарифы еще не созданы"
          description="Создайте первый базовый тариф для подключения учебных центров."
          action={
            <Button type="button" variant="primary" size="sm" onClick={openCreateModal}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Создать тариф</span>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="relative flex flex-col justify-between overflow-hidden">
              <CardContent className="flex h-full flex-col justify-between p-6">
                <div>
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium text-primary">Тарифный план</span>
                      <h3 className="mt-0.5 font-display text-lg font-semibold text-foreground">
                        {plan.name}
                      </h3>
                    </div>
                    {!plan.isActive && <Badge variant="destructive">НЕАКТИВЕН</Badge>}
                  </div>

                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-3xl font-bold text-foreground tabular-nums">
                      {Math.round(plan.priceMonthly).toLocaleString("ru-RU")}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">UZS / месяц</span>
                  </div>

                  <div className="mt-4 space-y-2.5 border-t border-border py-4 text-sm text-foreground">
                    <div className="flex items-center gap-2.5">
                      <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>
                        До <strong className="tabular-nums">{plan.maxStudents}</strong> учеников
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <GraduationCap className="h-4 w-4 shrink-0 text-info" aria-hidden="true" />
                      <span>
                        До <strong className="tabular-nums">{plan.maxTeachers}</strong> учителей
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      <span>
                        До <strong className="tabular-nums">{plan.maxCourses}</strong> курсов
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Building className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                      <span>
                        <strong className="tabular-nums">{plan.maxBranches}</strong> филиал(ов)
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span>
                        <strong className="tabular-nums">{Math.round(plan.maxStorage / 1024)} GB</strong> хранилища
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-border pt-3 text-xs">
                    {PLAN_FEATURE_KEYS.map((fKey) => {
                      const fMap = plan.features ?? parsePlanFeatures(plan.featuresJson);
                      const on = Boolean(fMap[fKey]);
                      return (
                        <div key={fKey} className="flex items-center gap-2">
                          {on ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                          ) : (
                            <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className={on ? "text-foreground" : "text-muted-foreground line-through"}>
                            {PLAN_FEATURE_LABELS[fKey].ru}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs text-muted-foreground">
                    <strong className="font-semibold text-foreground tabular-nums">
                      {plan._count?.subscriptions || 0}
                    </strong>{" "}
                    активных
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(plan)}
                  >
                    <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Изменить</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "Редактировать тариф" : "Новый тарифный план"}
            </DialogTitle>
          </DialogHeader>

          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Название тарифа" htmlFor="plan-name" required>
              <Input
                id="plan-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Стандарт, Про, Корпоративный..."
                required
              />
            </FormField>

            <FormField label="Цена в месяц (UZS)" htmlFor="plan-price" required>
              <Input
                id="plan-price"
                type="number"
                min="0"
                step="1"
                value={formData.priceMonthly}
                onChange={(e) =>
                  setFormData({ ...formData, priceMonthly: parseFloat(e.target.value) || 0 })
                }
                required
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Макс. учеников" htmlFor="plan-max-students" required>
                <Input
                  id="plan-max-students"
                  type="number"
                  min="1"
                  value={formData.maxStudents}
                  onChange={(e) =>
                    setFormData({ ...formData, maxStudents: parseInt(e.target.value, 10) || 1 })
                  }
                  required
                />
              </FormField>
              <FormField label="Макс. учителей" htmlFor="plan-max-teachers" required>
                <Input
                  id="plan-max-teachers"
                  type="number"
                  min="1"
                  value={formData.maxTeachers}
                  onChange={(e) =>
                    setFormData({ ...formData, maxTeachers: parseInt(e.target.value, 10) || 1 })
                  }
                  required
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Макс. курсов" htmlFor="plan-max-courses" required>
                <Input
                  id="plan-max-courses"
                  type="number"
                  min="1"
                  value={formData.maxCourses}
                  onChange={(e) =>
                    setFormData({ ...formData, maxCourses: parseInt(e.target.value, 10) || 1 })
                  }
                  required
                />
              </FormField>
              <FormField label="Макс. филиалов" htmlFor="plan-max-branches" required>
                <Input
                  id="plan-max-branches"
                  type="number"
                  min="1"
                  value={formData.maxBranches}
                  onChange={(e) =>
                    setFormData({ ...formData, maxBranches: parseInt(e.target.value, 10) || 1 })
                  }
                  required
                />
              </FormField>
            </div>

            <FormField label="Хранилище (MB)" htmlFor="plan-max-storage" required>
              <Input
                id="plan-max-storage"
                type="number"
                min="512"
                step="512"
                value={formData.maxStorage}
                onChange={(e) =>
                  setFormData({ ...formData, maxStorage: parseInt(e.target.value, 10) || 512 })
                }
                required
              />
            </FormField>

            <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <span>Активен для новых подписок</span>
            </label>

            <div className="space-y-2.5 border-t border-border pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Доступные модули тарифа
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormFeatures({ ...PLAN_PRESETS.start })}
                  >
                    Старт
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormFeatures({ ...PLAN_PRESETS.growth })}
                  >
                    Рост
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormFeatures({ ...PLAN_PRESETS.pro })}
                  >
                    Про
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {PLAN_FEATURE_KEYS.map((fKey) => (
                  <label
                    key={fKey}
                    className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-xs text-foreground hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={formFeatures[fKey]}
                      onChange={(e) =>
                        setFormFeatures((prev) => ({
                          ...prev,
                          [fKey]: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                    <span>{PLAN_FEATURE_LABELS[fKey].ru}</span>
                  </label>
                ))}
              </div>
            </div>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
