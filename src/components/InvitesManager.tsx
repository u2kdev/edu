"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Plus, Copy, Check, Users, Shield, Link2 } from "lucide-react";

interface InvitesManagerProps {
  initialInvites: any[];
  courses: any[];
  groups: any[];
  role?: string;
}

export default function InvitesManager({ initialInvites, courses, groups, role }: InvitesManagerProps) {
  const router = useRouter();
  const [invites, setInvites] = useState(initialInvites);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [targetRole, setTargetRole] = useState("STUDENT");
  const [courseId, setCourseId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [maxUses, setMaxUses] = useState("10");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redeem code form state
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const canGenerate = role === "DIRECTOR" || role === "CENTER_ADMIN";

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/invites/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole, courseId, groupId, maxUses }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowGenerateModal(false);
        router.refresh();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setRedeemSuccess(null);
    setRedeemError(null);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: redeemCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setRedeemSuccess(`Успешно! Вы присоединились к центру «${data.center.name}» с ролью ${data.role}`);
        setRedeemCode("");
        router.refresh();
      } else {
        setRedeemError(data.error);
      }
    } catch (err) {
      setRedeemError(" Ошибка при активации");
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Quick Redeem Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-brand-500/30 bg-brand-950/20">
        <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-brand-400" />
          <span>Активировать Инвайт-код</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Вам выдали пригласительный код? Введите его ниже для входа в курс или родительской привязки:
        </p>

        {redeemSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            {redeemSuccess}
          </div>
        )}
        {redeemError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            {redeemError}
          </div>
        )}

        <form onSubmit={handleRedeem} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            placeholder="e.g. JOIN-JS2026 или PARENT-1234"
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500 uppercase tracking-widest font-mono"
          />
          <button
            type="submit"
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/30 shrink-0"
          >
            Применить код
          </button>
        </form>
      </div>

      {/* Generated Invites Table (Admin View) */}
      {canGenerate && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Существующие Инвайт-коды Центра</h2>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Сгенерировать Код</span>
            </button>
          </div>

          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="p-4">Инвайт-код</th>
                  <th className="p-4">Роль-Назначение</th>
                  <th className="p-4">Курс / Группа</th>
                  <th className="p-4">Использования</th>
                  <th className="p-4 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {invites.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      Инвайт-коды еще не созданы.
                    </td>
                  </tr>
                ) : (
                  invites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-4 font-mono font-bold text-brand-400 tracking-wider">
                        {inv.code}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-200 text-xs font-semibold">
                          {inv.targetRole}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">
                        {inv.course?.title || inv.group?.name || "Общий код центра"}
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-white">{inv.usesCount}</span> / {inv.maxUses}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => copyToClipboard(inv.code)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                        >
                          {copiedCode === inv.code ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Скопировано</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Копировать</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white">Создать Новый Инвайт-код</h3>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Назначение Роли</label>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="STUDENT">Ученик (STUDENT)</option>
                  <option value="TEACHER">Учитель (TEACHER)</option>
                  <option value="PARENT">Родитель (PARENT)</option>
                  <option value="CENTER_ADMIN">Администратор центра (CENTER_ADMIN)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Привязать к Курсу (Опционально)</label>
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- Общий инвайт центра --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Максимум активаций</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand-600/30"
                >
                  {loading ? "Генерация..." : "Создать Код"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
