"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Building2, Plus, UserPlus, AlertCircle } from "lucide-react";

interface PlatformAdminManagerProps {
  initialCenters: any[];
  plans: any[];
  metrics: {
    totalCenters: number;
    activeCenters: number;
    frozenCenters: number;
  };
}

export default function PlatformAdminManager({ initialCenters, plans, metrics }: PlatformAdminManagerProps) {
  const router = useRouter();
  const [centers, setCenters] = useState(initialCenters);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states for Superadmin creating center & director
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [centerType, setCenterType] = useState("HYBRID");
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [directorEmail, setDirectorEmail] = useState("");
  const [directorFullName, setDirectorFullName] = useState("");
  const [directorPhone, setDirectorPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleNameChange = (val: string) => {
    setName(val);
    const autoSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9а-я\s-]/g, "")
      .replace(/[\s_]+/g, "-");
    setSlug(autoSlug);
  };

  const handleCreateCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/platform/centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          centerType,
          planId,
          directorEmail,
          directorFullName,
          directorPhone,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowCreateModal(false);
        setName("");
        setSlug("");
        setDirectorEmail("");
        setDirectorFullName("");
        router.refresh();
      } else {
        setError(data.error || "Ошибка при создании центра");
      }
    } catch (err: any) {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (centerId: string, newStatus: string) => {
    try {
      const res = await fetch("/api/platform/centers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centerId, status: newStatus }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      alert("Ошибка сети");
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics & Create Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full sm:w-auto flex-1">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Всего Центров</span>
            <div className="text-2xl font-bold text-white mt-1">{metrics.totalCenters}</div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Активных</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{metrics.activeCenters}</div>
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Заморожены (Frozen)</span>
            <div className="text-2xl font-bold text-amber-400 mt-1">{metrics.frozenCenters}</div>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto px-5 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-2xl shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Создать Учебный Центр</span>
        </button>
      </div>

      {/* Centers Control Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white">Реестр Учебных Центров (Тенантов)</h2>

        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">Учебный Центр</th>
                <th className="p-4">Владелец (Директор)</th>
                <th className="p-4">Тариф Подписки</th>
                <th className="p-4">Статус</th>
                <th className="p-4 text-right">Управление Статусом</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {centers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    Центры еще не созданы. Нажмите «Создать Учебный Центр», чтобы добавить первый тенант.
                  </td>
                </tr>
              ) : (
                centers.map((c) => {
                  const sub = c.subscriptions[0];
                  return (
                    <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-purple-400" />
                          <span>{c.name}</span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">slug: {c.slug}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-slate-200">{c.owner?.fullName}</div>
                        <div className="text-xs text-slate-500">{c.owner?.email}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded bg-slate-800 text-xs font-semibold text-brand-300">
                          {sub?.plan?.name || "Trial"}
                        </span>
                      </td>
                      <td className="p-4">
                        {c.status === "ACTIVE" && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                            ACTIVE
                          </span>
                        )}
                        {c.status === "TRIAL" && (
                          <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold">
                            TRIAL
                          </span>
                        )}
                        {c.status === "FROZEN" && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold">
                            FROZEN
                          </span>
                        )}
                        {c.status === "BLOCKED" && (
                          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 text-xs font-bold">
                            BLOCKED
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-2">
                        {c.status !== "ACTIVE" && (
                          <button
                            onClick={() => handleUpdateStatus(c.id, "ACTIVE")}
                            className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-500/30 transition-colors"
                          >
                            Активировать
                          </button>
                        )}
                        {c.status !== "FROZEN" && (
                          <button
                            onClick={() => handleUpdateStatus(c.id, "FROZEN")}
                            className="px-3 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/30 transition-colors"
                          >
                            Заморозить
                          </button>
                        )}
                        {c.status !== "BLOCKED" && (
                          <button
                            onClick={() => handleUpdateStatus(c.id, "BLOCKED")}
                            className="px-3 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-lg text-xs font-semibold border border-rose-500/30 transition-colors"
                          >
                            Заблокировать
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Superadmin Modal: Create LearningCenter & Assign Director */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-xl p-6 rounded-3xl border border-slate-800 space-y-6 max-h-[90vh] overflow-y-auto">
            <div>
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Только Платформа</span>
              <h3 className="text-xl font-bold text-white mt-1">Создание Учебного Центра и Аккаунта Директора</h3>
              <p className="text-xs text-slate-400 mt-1">
                Создайте новый тенант и назначьте его руководителя. Директору будет автоматически привязан воркспейс.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateCenter} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Название Центра</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Школа Кодинга Квантум"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Slug (URL Идентификатор)</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="e.g. quantum-coding"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Формат Обучения</label>
                  <select
                    value={centerType}
                    onChange={(e) => setCenterType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    <option value="HYBRID">Гибридный (Офлайн + Онлайн)</option>
                    <option value="OFFLINE">Офлайн-центр</option>
                    <option value="ONLINE">Онлайн-школа</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Тариф Подписки</label>
                  <select
                    value={planId}
                    onChange={(e) => setPlanId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.priceMonthly} ₽/мес)</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-purple-400" />
                  <span>Данные Будущего Директора Центра</span>
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">ФИО Директора</label>
                  <input
                    type="text"
                    required
                    value={directorFullName}
                    onChange={(e) => setDirectorFullName(e.target.value)}
                    placeholder="e.g. Александр Волков"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Директора</label>
                    <input
                      type="email"
                      required
                      value={directorEmail}
                      onChange={(e) => setDirectorEmail(e.target.value)}
                      placeholder="director@quantum.ru"
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Телефон</label>
                    <input
                      type="tel"
                      value={directorPhone}
                      onChange={(e) => setDirectorPhone(e.target.value)}
                      placeholder="+7 (999) 111-22-33"
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-purple-600/30"
                >
                  {loading ? "Создание..." : "Создать Центр и Зарегистрировать Директора"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
