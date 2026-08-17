"use client";

import { useState, useEffect } from "react";
import { Building2, Mail, User, Phone, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CreateTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    directorEmail: "",
    directorFullName: "",
    directorPhone: "",
    planId: "",
  });

  useEffect(() => {
    fetch("/api/platform/plans")
      .then(res => res.json())
      .then(data => setPlans(data.plans || []));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    
    // Auto-generate slug from name if slug is empty or user is typing name
    if (e.target.name === "name" && !formData.slug) {
      setFormData(prev => ({
        ...prev,
        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/platform/centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка при создании центра");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/platform/tenants/${data.center.id}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Учебный центр успешно создан!</h2>
        <p className="text-slate-400">Воркспейс, профиль владельца и начальная подписка инициализированы.</p>
        <p className="text-sm text-slate-500 mt-4">Перенаправление...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/platform/tenants" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Создать новый учебный центр</h1>
          <p className="text-slate-400 text-sm">Добавление нового клиента (Tenant) на платформу</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel p-8 rounded-2xl border border-slate-800 space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white border-b border-slate-800 pb-2">Общая информация</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Название центра *</label>
              <div className="relative">
                <Building2 className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  required name="name" value={formData.name} onChange={handleChange}
                  placeholder="e.g. Школа Кодинга"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">System Slug *</label>
              <input 
                required name="slug" value={formData.slug} onChange={handleChange}
                placeholder="e.g. coding-school"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white border-b border-slate-800 pb-2">Владелец (Директор)</h3>
          
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email владельца *</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                required type="email" name="directorEmail" value={formData.directorEmail} onChange={handleChange}
                placeholder="director@example.com"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">Если пользователь с таким email уже существует, он будет назначен владельцем. Иначе будет создан новый аккаунт с паролем Password123!</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">ФИО владельца *</label>
              <div className="relative">
                <User className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  required name="directorFullName" value={formData.directorFullName} onChange={handleChange}
                  placeholder="Иван Иванов"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Телефон</label>
              <div className="relative">
                <Phone className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  name="directorPhone" value={formData.directorPhone} onChange={handleChange}
                  placeholder="+998901234567"
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white border-b border-slate-800 pb-2">Тарифный план</h3>
          
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Начальный тариф *</label>
            <select 
              name="planId" value={formData.planId} onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-500"
            >
              <option value="">Выберите тариф (по умолчанию Trial)</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>{p.name} (${p.priceMonthly}/mo)</option>
              ))}
            </select>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50"
        >
          {loading ? "Создание инфраструктуры..." : "Создать Tenant"}
        </button>
      </form>
    </div>
  );
}
