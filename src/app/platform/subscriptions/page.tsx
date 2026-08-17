"use client";

import { useEffect, useState } from "react";
import { CreditCard, Check, Shield, Zap, Info } from "lucide-react";

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/platform/plans")
      .then((res) => res.json())
      .then((json) => setPlans(json.plans || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Loading plans...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Тарифы и Биллинг</h1>
          <p className="text-slate-400 text-sm">Управление SaaS тарифами и лимитами</p>
        </div>
        <button className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-brand-500/20">
          + Создать тариф
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="glass-panel p-8 rounded-3xl border border-slate-800 flex flex-col relative overflow-hidden">
            {!plan.isActive && (
              <div className="absolute top-4 right-4 px-2 py-1 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-lg border border-rose-500/20">
                INACTIVE
              </div>
            )}
            
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-brand-400">${plan.priceMonthly}</span>
                <span className="text-slate-500 font-medium">/ мес</span>
              </div>
            </div>

            <div className="flex-1 space-y-4 mb-8">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Check className="w-5 h-5 text-emerald-400" />
                <span>До <strong className="text-white">{plan.maxStudents}</strong> студентов</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Check className="w-5 h-5 text-emerald-400" />
                <span>До <strong className="text-white">{plan.maxTeachers}</strong> преподавателей</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Check className="w-5 h-5 text-emerald-400" />
                <span>До <strong className="text-white">{plan.maxCourses}</strong> курсов</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Check className="w-5 h-5 text-emerald-400" />
                <span><strong className="text-white">{plan.maxBranches}</strong> филиал(ов)</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Check className="w-5 h-5 text-emerald-400" />
                <span><strong className="text-white">{plan.maxStorage / 1024} GB</strong> хранилища</span>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 flex justify-between items-center">
              <div className="text-sm text-slate-400">
                <strong className="text-white">{plan._count.subscriptions}</strong> активных
              </div>
              <button className="text-sm font-semibold text-brand-400 hover:text-brand-300 transition-colors">
                Изменить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
