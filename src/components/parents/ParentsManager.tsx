"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Heart,
  Mail,
  Phone,
  Clock,
  Send,
  GraduationCap,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { t } from "@/i18n";
import { CredentialsModal, type CredentialsData } from "@/components/CredentialsModal";

export interface ParentItem {
  id: string;
  userId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: string;
  lastLoginAt: string | null;
  children: Array<{
    id: string;
    fullName: string;
    relationship?: string | null;
  }>;
}

interface ParentsManagerProps {
  initialParents: ParentItem[];
  locale: string;
  role: string;
}

export function ParentsManager({
  initialParents,
  locale,
  role,
}: ParentsManagerProps) {
  const [parents, setParents] = useState<ParentItem[]>(initialParents);
  const [search, setSearch] = useState("");
  const [filterNeverLoggedIn, setFilterNeverLoggedIn] = useState(false);

  // Add Parent Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRelationship, setAddRelationship] = useState("MOTHER");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Single-display credentials
  const [credentials, setCredentials] = useState<CredentialsData | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredParents = parents.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.fullName.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      p.children.some((c) => c.fullName.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (filterNeverLoggedIn && p.lastLoginAt) return false;

    return true;
  });

  const handleCreateParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addPhone && !addEmail) {
      setAddError("Укажите телефон или email родителя");
      return;
    }

    setAddLoading(true);
    setAddError(null);

    try {
      const res = await fetch("/api/tenant/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: addName,
          phone: addPhone || undefined,
          email: addEmail || undefined,
          role: "PARENT",
          parent: {
            fullName: addName,
            phone: addPhone,
            email: addEmail,
            relationship: addRelationship,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания родителя");

      setParents((prev) => [
        {
          id: data.user?.membershipId || String(Date.now()),
          userId: data.user?.id || "",
          fullName: addName,
          phone: data.user?.phone || null,
          email: data.user?.email || null,
          status: "ACTIVE",
          lastLoginAt: null,
          children: [],
        },
        ...prev,
      ]);

      if (data.credentials) {
        setCredentials(data.credentials);
      }

      setAddModalOpen(false);
      setAddName("");
      setAddPhone("");
      setAddEmail("");
      setActionNotice({ type: "success", text: "Родитель успешно добавлен" });
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setAddLoading(false);
    }
  };

  const handleSendReset = async (membershipId: string) => {
    try {
      const res = await fetch(`/api/tenant/users/${membershipId}/send-reset-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отправки ссылки");

      setActionNotice({
        type: "success",
        text: data.resetUrl ? `Ссылка создана: ${data.resetUrl}` : "Ссылка для сброса пароля отправлена",
      });
    } catch (err: unknown) {
      setActionNotice({ type: "error", text: err instanceof Error ? err.message : "Неизвестная ошибка" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Heart className="w-6 h-6 text-brand-400" />
            <span>{t(locale, "nav.parents")}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Управление аккаунтами родителей и привязками к ученикам центра
          </p>
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить родителя</span>
        </button>
      </div>

      {actionNotice && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            actionNotice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          {actionNotice.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{actionNotice.text}</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону, email или имени ребенка..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterNeverLoggedIn(!filterNeverLoggedIn)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap ${
              filterNeverLoggedIn
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Ни разу не входили
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3 font-semibold">Родитель</th>
                <th className="px-4 py-3 font-semibold">Контакты</th>
                <th className="px-4 py-3 font-semibold">Дети (ученики)</th>
                <th className="px-4 py-3 font-semibold">Последний вход</th>
                <th className="px-4 py-3 font-semibold">Статус</th>
                <th className="px-4 py-3 font-semibold text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredParents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Родители не найдены
                  </td>
                </tr>
              ) : (
                filteredParents.map((parent) => (
                  <tr key={parent.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-white text-xs">{parent.fullName}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-300">
                      {parent.phone && <div>{parent.phone}</div>}
                      {parent.email && <div className="text-slate-500">{parent.email}</div>}
                      {!parent.phone && !parent.email && <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {parent.children.length === 0 ? (
                        <span className="text-slate-500">Нет привязанных детей</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {parent.children.map((child) => (
                            <Link
                              key={child.id}
                              href={`/center/students/${child.id}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 rounded-md text-[11px] font-medium transition-colors"
                            >
                              <GraduationCap className="w-3 h-3" />
                              <span>{child.fullName}</span>
                              {child.relationship && (
                                <span className="text-[9px] text-slate-400">({child.relationship})</span>
                              )}
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {parent.lastLoginAt ? (
                        <span className="text-slate-300 font-mono text-[11px]">
                          {new Date(parent.lastLoginAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-semibold">
                          <Clock className="w-3 h-3" />
                          Ни разу не входил
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          parent.status === "ACTIVE"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        }`}
                      >
                        {parent.status === "ACTIVE" ? "Активен" : "Заблокирован"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => handleSendReset(parent.id)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                        title="Отправить ссылку сброса пароля"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Parent Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Добавить родителя</h3>
            <p className="text-xs text-slate-400">
              Создайте учетную запись родителя. Данные для входа будут показаны один раз.
            </p>

            {addError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
                {addError}
              </div>
            )}

            <form onSubmit={handleCreateParent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ФИО</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="ФИО родителя"
                  required
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Телефон</label>
                <input
                  type="text"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Родство по умолчанию</label>
                <select
                  value={addRelationship}
                  onChange={(e) => setAddRelationship(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="MOTHER">Мама</option>
                  <option value="FATHER">Папа</option>
                  <option value="GUARDIAN">Опекун</option>
                  <option value="OTHER">Другой родственник</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {addLoading ? "Создание..." : "Создать аккаунт"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single-display credentials */}
      {credentials && (
        <CredentialsModal
          isOpen={Boolean(credentials)}
          onClose={() => setCredentials(null)}
          credentials={credentials}
          locale={locale}
        />
      )}
    </div>
  );
}
