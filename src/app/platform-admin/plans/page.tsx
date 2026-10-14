"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  CreditCard,
  Check,
  Plus,
  Edit2,
  Users,
  GraduationCap,
  BookOpen,
  Building,
  HardDrive,
  X,
} from "lucide-react";

interface SubscriptionPlanItem {
  id: string;
  name: string;
  priceMonthly: number;
  maxStudents: number;
  maxTeachers: number;
  maxCourses: number;
  maxBranches: number;
  maxStorage: number;
  isActive: boolean;
  _count?: { subscriptions: number };
}

export default function PlatformPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
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
  const [saving, setSaving] = useState(false);

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
    setFormData({
      name: "",
      priceMonthly: 50,
      maxStudents: 100,
      maxTeachers: 10,
      maxCourses: 20,
      maxBranches: 1,
      maxStorage: 5120,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (plan: SubscriptionPlanItem) => {
    setEditingPlan(plan);
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
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = "/api/platform/plans";
      const method = editingPlan ? "PATCH" : "POST";
      const body = editingPlan ? { ...formData, id: editingPlan.id } : formData;

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
      alert(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Тарифные планы SaaS
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Настройка подписок, ценообразования и системных лимитов для учебных центров
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Создать тариф</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-sm animate-pulse">
          Загрузка тарифных планов...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center shadow-sm">
          {error}
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Тарифы еще не созданы</h3>
          <p className="text-sm text-slate-500 mt-1">
            Создайте первый базовый тариф для подключения учебных центров.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between relative overflow-hidden"
            >
              {!plan.isActive && (
                <div className="absolute top-4 right-4 px-2.5 py-0.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-full border border-rose-200">
                  НЕАКТИВЕН
                </div>
              )}

              <div>
                <div className="mb-4">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                    Тарифный план
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 mt-0.5">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-extrabold text-slate-900">${plan.priceMonthly}</span>
                    <span className="text-xs font-medium text-slate-500">/ месяц</span>
                  </div>
                </div>

                <div className="space-y-3 py-4 border-t border-slate-100 text-sm">
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <Users className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>До <strong className="font-semibold text-slate-900">{plan.maxStudents}</strong> учеников</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>До <strong className="font-semibold text-slate-900">{plan.maxTeachers}</strong> учителей</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>До <strong className="font-semibold text-slate-900">{plan.maxCourses}</strong> курсов</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <Building className="w-4 h-4 text-amber-600 shrink-0" />
                    <span><strong className="font-semibold text-slate-900">{plan.maxBranches}</strong> филиал(ов)</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700">
                    <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
                    <span><strong className="font-semibold text-slate-900">{Math.round(plan.maxStorage / 1024)} GB</strong> хранилища</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-4">
                <span className="text-xs font-medium text-slate-500">
                  <strong className="text-slate-900 font-bold">{plan._count?.subscriptions || 0}</strong> активных
                </span>
                <button
                  onClick={() => openEditModal(plan)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Изменить</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog for Plan Create / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setModalOpen(false)}
          />

          <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 z-10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingPlan ? "Редактировать тариф" : "Новый тарифный план"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Название тарифа
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Стандарт, Про, Корпоративный..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Цена в месяц (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.priceMonthly}
                  onChange={(e) => setFormData({ ...formData, priceMonthly: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Макс. учеников
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxStudents}
                    onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value, 10) || 1 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Макс. учителей
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxTeachers}
                    onChange={(e) => setFormData({ ...formData, maxTeachers: parseInt(e.target.value, 10) || 1 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Макс. курсов
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxCourses}
                    onChange={(e) => setFormData({ ...formData, maxCourses: parseInt(e.target.value, 10) || 1 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Макс. филиалов
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxBranches}
                    onChange={(e) => setFormData({ ...formData, maxBranches: parseInt(e.target.value, 10) || 1 })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Хранилище (MB)
                </label>
                <input
                  type="number"
                  min="512"
                  step="512"
                  value={formData.maxStorage}
                  onChange={(e) => setFormData({ ...formData, maxStorage: parseInt(e.target.value, 10) || 512 })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-700">
                  Активен для новых подписок
                </label>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50"
                >
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
