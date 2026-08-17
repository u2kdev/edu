"use client";

import { useState, useEffect } from "react";
import {
  UserPlus, Shield, GraduationCap, HeadphonesIcon,
  MoreVertical, CheckCircle2, XCircle, Mail, Phone,
  Loader2, AlertTriangle
} from "lucide-react";

interface StaffMember {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    phone: string | null;
    fullName: string;
    avatarUrl: string | null;
    isActive: boolean;
    createdAt: string;
  };
}

interface StaffManagerProps {
  locale: string;
  currentRole: string;
}

const ROLE_CONFIG: Record<string, { label: string; labelUz: string; icon: any; color: string }> = {
  DIRECTOR: {
    label: "Директор",
    labelUz: "Direktor",
    icon: Shield,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  },
  CENTER_ADMIN: {
    label: "Админ центра",
    labelUz: "Markaz admini",
    icon: Shield,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
  TEACHER: {
    label: "Преподаватель",
    labelUz: "Oʻqituvchi",
    icon: GraduationCap,
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  },
  CENTER_SUPPORT: {
    label: "Саппорт центра",
    labelUz: "Markaz qoʻllab-quvvatlashi",
    icon: HeadphonesIcon,
    color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  },
};

export default function StaffManager({ locale, currentRole }: StaffManagerProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("TEACHER");

  const isUz = locale === "uz-Latn";

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/staff");
      const data = await res.json();
      if (data.staff) setStaff(data.staff);
    } catch (err) {
      setError("Failed to load staff");
    }
    setLoading(false);
  }

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/tenant/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          fullName: newName,
          phone: newPhone || undefined,
          staffRole: newRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error adding staff member");
        setSaving(false);
        return;
      }

      setSuccess(
        isUz
          ? `${newName} muvaffaqiyatli qoʻshildi!`
          : `${newName} успешно добавлен(а)!`
      );
      setNewEmail("");
      setNewName("");
      setNewPhone("");
      setNewRole("TEACHER");
      setShowAddForm(false);
      await loadStaff();
    } catch (err) {
      setError("Network error");
    }
    setSaving(false);
  }

  async function toggleStatus(membershipId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch("/api/tenant/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      await loadStaff();
      setSuccess(
        isUz
          ? `Xodim holati oʻzgartirildi`
          : `Статус сотрудника изменён`
      );
    } catch (err) {
      setError("Network error");
    }
  }

  // Available roles that current user can assign
  const assignableRoles =
    currentRole === "DIRECTOR"
      ? ["CENTER_ADMIN", "TEACHER", "CENTER_SUPPORT"]
      : ["TEACHER", "CENTER_SUPPORT"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-brand-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            {isUz ? "Markaz xodimlari" : "Сотрудники центра"}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {isUz
              ? `Jami ${staff.length} xodim`
              : `Всего ${staff.length} сотрудников`}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all text-sm shadow-lg shadow-brand-600/20"
        >
          <UserPlus className="w-4 h-4" />
          {isUz ? "Xodim qoʻshish" : "Добавить сотрудника"}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-300 hover:text-white">✕</button>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Add Staff Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddStaff}
          className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4"
        >
          <h3 className="text-base font-bold text-white">
            {isUz ? "Yangi xodim qoʻshish" : "Добавить нового сотрудника"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {isUz ? "FISh *" : "ФИО *"}
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                placeholder={isUz ? "Ism Familiya" : "Иван Петров"}
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Email *
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="staff@example.com"
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {isUz ? "Telefon" : "Телефон"}
              </label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                {isUz ? "Rol" : "Роль"} *
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500 transition-colors"
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {isUz
                      ? ROLE_CONFIG[r]?.labelUz || r
                      : ROLE_CONFIG[r]?.label || r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isUz ? "Qoʻshish" : "Добавить"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-all text-sm"
            >
              {isUz ? "Bekor qilish" : "Отмена"}
            </button>
          </div>
        </form>
      )}

      {/* Staff List */}
      <div className="space-y-3">
        {staff.map((member) => {
          const roleConfig = ROLE_CONFIG[member.role] || {
            label: member.role,
            labelUz: member.role,
            icon: Shield,
            color: "text-slate-400 bg-slate-500/10 border-slate-500/20",
          };
          const RoleIcon = roleConfig.icon;
          const isInactive = member.status !== "ACTIVE";

          return (
            <div
              key={member.id}
              className={`glass-panel p-5 rounded-2xl border border-slate-800 flex items-center gap-4 transition-all ${
                isInactive ? "opacity-50" : ""
              }`}
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm font-bold text-brand-400 shrink-0">
                {member.user.fullName.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">
                    {member.user.fullName}
                  </span>
                  {isInactive && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-semibold border border-red-500/20">
                      {isUz ? "Faolsiz" : "Неактивен"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {member.user.email}
                  </span>
                  {member.user.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {member.user.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Role badge */}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${roleConfig.color} shrink-0`}
              >
                <RoleIcon className="w-3.5 h-3.5" />
                {isUz ? roleConfig.labelUz : roleConfig.label}
              </div>

              {/* Actions */}
              {member.role !== "DIRECTOR" && (
                <button
                  onClick={() => toggleStatus(member.id, member.status)}
                  className={`p-2 rounded-lg transition-colors shrink-0 ${
                    member.status === "ACTIVE"
                      ? "text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      : "text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                  }`}
                  title={
                    member.status === "ACTIVE"
                      ? isUz ? "Faolsizlantirish" : "Деактивировать"
                      : isUz ? "Faollashtirish" : "Активировать"
                  }
                >
                  {member.status === "ACTIVE" ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </button>
              )}
            </div>
          );
        })}

        {staff.length === 0 && (
          <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
            <UserPlus className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">
              {isUz
                ? "Hali xodimlar qoʻshilmagan"
                : "Сотрудники ещё не добавлены"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
