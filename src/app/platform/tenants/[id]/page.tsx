"use client";

import { useEffect, useState } from "react";
import { Building2, Mail, Users, ArrowLeft, CheckCircle2, ShieldAlert, PauseCircle, Ban, ArrowRight, Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function TenantDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [centers, setCenters] = useState<any[]>([]);
  const [center, setCenter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState(false);

  // For MVP, we use the list API and filter. In a real app we'd have a GET /api/platform/centers/:id
  useEffect(() => {
    fetch("/api/platform/centers")
      .then((res) => res.json())
      .then((json) => {
        setCenters(json.centers || []);
        const found = (json.centers || []).find((c: any) => c.id === params.id);
        setCenter(found);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleImpersonate = async () => {
    if (!confirm(`Вы уверены, что хотите войти в систему как ${center.owner.fullName}? Все ваши действия будут логироваться.`)) {
      return;
    }
    
    setImpersonating(true);
    try {
      const res = await fetch("/api/platform/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: center.owner.id,
          targetCenterId: center.id,
          reason: "Platform Admin Support Inspection"
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      // Redirect to dashboard as the impersonated user
      window.location.href = "/dashboard";
    } catch (err: any) {
      alert("Ошибка: " + err.message);
      setImpersonating(false);
    }
  };

  if (loading) return <div className="text-slate-400">Загрузка информации о центре...</div>;
  if (!center) return <div className="text-rose-400">Центр не найден.</div>;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/platform/tenants" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            {center.name}
            <span className="text-sm font-normal text-slate-500 bg-slate-900 px-2 py-1 rounded-md">{center.status}</span>
          </h1>
          <p className="text-slate-400 text-sm">Управление воркспейсом</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Информация о центре</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 text-sm font-medium text-slate-400">System Slug</div>
                <div className="col-span-2 text-sm text-white">{center.slug}</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 text-sm font-medium text-slate-400">ID</div>
                <div className="col-span-2 text-sm text-slate-500 font-mono">{center.id}</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 text-sm font-medium text-slate-400">Создан</div>
                <div className="col-span-2 text-sm text-white">{new Date(center.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Владелец</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-brand-400 font-bold text-lg">
                {center.owner.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-white font-medium">{center.owner.fullName}</p>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Mail className="w-3.5 h-3.5" />
                  {center.owner.email}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Action Panel */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-brand-500/5">
            <h3 className="text-lg font-bold text-white mb-4">Действия</h3>
            
            <button
              onClick={handleImpersonate}
              disabled={impersonating}
              className="w-full mb-4 px-4 py-3 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ArrowRight className="w-4 h-4" />
              {impersonating ? "Вход..." : "Войти как владелец"}
            </button>
            <p className="text-xs text-slate-500 text-center">
              Позволяет войти в кабинет от лица владельца центра для оказания технической поддержки.
            </p>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4">Тариф и Статус</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Текущий план</p>
                <p className="text-indigo-400 font-semibold">{center.subscriptions?.[0]?.plan?.name || "Нет активного плана"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Статус воркспейса</p>
                <select 
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 mt-1"
                  defaultValue={center.status}
                  // In a real app, this would trigger PATCH /api/platform/centers
                  onChange={() => alert("Change status requires PATCH endpoint connection")}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="TRIAL">TRIAL</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="OVERDUE">OVERDUE</option>
                  <option value="BLOCKED">BLOCKED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
