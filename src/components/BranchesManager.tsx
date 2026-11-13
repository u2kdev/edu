"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Archive,
  RotateCcw,
  AlertCircle,
  Loader2,
} from "lucide-react";

export interface BranchItem {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string | Date;
  _count: { groups: number };
}

interface BranchesManagerProps {
  initialBranches: BranchItem[];
  locale?: string;
}

export default function BranchesManager({ initialBranches, locale = "ru" }: BranchesManagerProps) {
  const router = useRouter();
  const [branches, setBranches] = useState<BranchItem[]>(initialBranches);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchItem | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeBranches = branches.filter((b) => b.isActive);
  const inactiveBranches = branches.filter((b) => !b.isActive);

  const openCreateModal = () => {
    setEditingBranch(null);
    setName("");
    setAddress("");
    setPhone("");
    setEmail("");
    setErrorMessage(null);
    setShowModal(true);
  };

  const openEditModal = (branch: BranchItem) => {
    setEditingBranch(branch);
    setName(branch.name);
    setAddress(branch.address || "");
    setPhone(branch.phone || "");
    setEmail(branch.email || "");
    setErrorMessage(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      if (editingBranch) {
        // PATCH
        const res = await fetch("/api/tenant/branches", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingBranch.id,
            name: name.trim(),
            address: address.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Не удалось обновить филиал");
          return;
        }
        setShowModal(false);
        router.refresh();
      } else {
        // POST
        const res = await fetch("/api/tenant/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            address: address.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Не удалось создать филиал");
          return;
        }
        setShowModal(false);
        router.refresh();
      }
    } catch {
      setErrorMessage("Ошибка сети при сохранении филиала");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleArchive = async (branch: BranchItem) => {
    const actionName = branch.isActive ? "архивировать" : "восстановить";
    if (!confirm(`Вы действительно хотите ${actionName} филиал «${branch.name}»?`)) {
      return;
    }

    try {
      const res = await fetch("/api/tenant/branches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: branch.id,
          isActive: !branch.isActive,
        }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось изменить статус филиала");
      }
    } catch {
      alert("Ошибка сети");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-400" />
            Филиалы
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {activeBranches.length} активных · {inactiveBranches.length} архивированных
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors flex items-center gap-2 self-start sm:self-auto shadow-lg shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          Добавить филиал
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Всего филиалов</div>
          <div className="text-3xl font-extrabold text-white mt-1">{branches.length}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Активные</div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">{activeBranches.length}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Групп в сумме</div>
          <div className="text-3xl font-extrabold text-brand-400 mt-1">
            {branches.reduce((sum, b) => sum + (b._count?.groups || 0), 0)}
          </div>
        </div>
      </div>

      {/* Branches List */}
      {branches.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center">
          <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-1">Нет филиалов</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
            Добавьте первый филиал для организации расписания и учебных групп.
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить филиал
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className={`glass-panel p-6 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
                branch.isActive
                  ? "border-slate-800 hover:border-brand-500/30"
                  : "border-slate-800/50 opacity-60 bg-slate-900/20"
              }`}
            >
              <div className="space-y-4">
                {/* Branch Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-brand-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{branch.name}</h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        {branch.isActive ? (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Активен
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                            <XCircle className="w-3 h-3" /> Архивирован
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                  {branch.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{branch.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1 text-slate-400">
                    <Users className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                    <span>{branch._count?.groups || 0} учебных групп</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2 text-xs">
                <button
                  onClick={() => openEditModal(branch)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors flex items-center gap-1.5"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                  Изменить
                </button>
                <button
                  onClick={() => handleToggleArchive(branch)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                    branch.isActive
                      ? "bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300"
                      : "bg-slate-800 hover:bg-emerald-950/40 text-slate-300 hover:text-emerald-300"
                  }`}
                >
                  {branch.isActive ? (
                    <>
                      <Archive className="w-3.5 h-3.5 text-slate-400" />
                      Архивировать
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                      Восстановить
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-400" />
                {editingBranch ? "Редактировать филиал" : "Новый филиал"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Название филиала *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Главный кампус или Чиланзар"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Адрес
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. ул. Амира Темура, 45"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Телефон
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +998 71 123 45 67"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="branch@edarschi.uz"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editingBranch ? "Сохранить изменения" : "Создать филиал"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
