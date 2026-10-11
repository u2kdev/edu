"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Upload,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileText,
  Filter,
} from "lucide-react";
import { t } from "@/i18n";

interface GroupOption {
  id: string;
  name: string;
}

interface StudentItem {
  id: string; // CenterMembership.id
  status: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone?: string | null;
  };
  enrollments: {
    id: string;
    status: string;
    group: {
      id: string;
      name: string;
      course?: { title: string };
    };
  }[];
  parentLinksAsStudent?: {
    parent: {
      user: { fullName: string; phone?: string | null };
    };
  }[];
}

interface StudentsManagerProps {
  initialGroups: GroupOption[];
  role: string;
  locale: string;
}

export default function StudentsManager({
  initialGroups,
  role,
  locale,
}: StudentsManagerProps) {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination state
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Add form state
  const [addFullName, setAddFullName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addGroupId, setAddGroupId] = useState("");
  const [addWithInvite, setAddWithInvite] = useState(true);
  const [addLoading, setAddLoading] = useState(false);
  const [addCreatedCode, setAddCreatedCode] = useState<string | null>(null);

  // CSV modal state
  const [csvContent, setCsvContent] = useState("");
  const [csvPreviewData, setCsvPreviewData] = useState<{
    totalParsed: number;
    validCount: number;
    errorCount: number;
    validPreview: { fullName: string; email: string; phone?: string; groupId?: string }[];
    errors: { row: number; error: string; raw: string }[];
  } | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    createdCount: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  const canManage = role === "DIRECTOR" || role === "CENTER_ADMIN";

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "15",
        search,
        groupId: selectedGroup,
        status: selectedStatus,
        sortBy,
        sortOrder,
      });

      const res = await fetch(`/api/students?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t(locale, "students.errorLoading"));
      }

      setStudents(data.students || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.totalCount || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t(locale, "students.errorLoading");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, selectedGroup, selectedStatus, sortBy, sortOrder]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: addFullName,
          email: addEmail,
          phone: addPhone,
          groupId: addGroupId || undefined,
          withInvite: addWithInvite,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Ошибка создания студента");
      } else {
        if (data.inviteCode) {
          setAddCreatedCode(data.inviteCode);
        } else {
          setShowAddModal(false);
          setAddFullName("");
          setAddEmail("");
          setAddPhone("");
          setAddGroupId("");
        }
        fetchStudents();
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setAddLoading(false);
    }
  };

  const handleCsvPreview = async () => {
    if (!csvContent.trim()) return;
    setCsvLoading(true);
    try {
      const res = await fetch("/api/students/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, mode: "preview" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Ошибка обработки CSV");
      } else {
        setCsvPreviewData(data);
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setCsvLoading(false);
    }
  };

  const handleCsvExecute = async () => {
    if (!csvContent.trim()) return;
    setCsvLoading(true);
    try {
      const res = await fetch("/api/students/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, mode: "execute" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Ошибка импорта CSV");
      } else {
        setCsvResult(data);
        fetchStudents();
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setCsvLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Users className="w-6 h-6 text-brand-400" />
            <span>{t(locale, "students.title")}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t(locale, "students.totalCount", { count: totalCount })}
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCsvPreviewData(null);
                setCsvResult(null);
                setCsvContent("");
                setShowCsvModal(true);
              }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>{t(locale, "students.importCsv")}</span>
            </button>
            <button
              onClick={() => {
                setAddCreatedCode(null);
                setShowAddModal(true);
              }}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t(locale, "students.addStudent")}</span>
            </button>
          </div>
        )}
      </div>

      {/* Filters and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t(locale, "students.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Group Filter */}
          <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700/80">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">{t(locale, "students.filterGroup")}</option>
              {initialGroups.map((g) => (
                <option key={g.id} value={g.id} className="bg-slate-900">
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-900 px-3 py-2 rounded-xl border border-slate-700/80 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-slate-900">{t(locale, "students.filterStatus")}</option>
            <option value="ACTIVE" className="bg-slate-900">{t(locale, "students.statusActive")}</option>
            <option value="ARCHIVED" className="bg-slate-900">{t(locale, "students.statusArchived")}</option>
          </select>

          {/* Sorting */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split("-") as [string, "asc" | "desc"];
              setSortBy(sb);
              setSortOrder(so);
            }}
            className="bg-slate-900 px-3 py-2 rounded-xl border border-slate-700/80 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="name-asc" className="bg-slate-900">{t(locale, "students.sortName")} ({t(locale, "students.sortAsc")})</option>
            <option value="name-desc" className="bg-slate-900">{t(locale, "students.sortName")} ({t(locale, "students.sortDesc")})</option>
            <option value="createdAt-desc" className="bg-slate-900">{t(locale, "students.sortDate")} ({t(locale, "students.sortNewest")})</option>
            <option value="createdAt-asc" className="bg-slate-900">{t(locale, "students.sortDate")} ({t(locale, "students.sortOldest")})</option>
          </select>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <span>{t(locale, "students.loading")}</span>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="glass-panel p-8 rounded-2xl border border-rose-500/30 text-center text-rose-400 space-y-3">
          <AlertCircle className="w-8 h-8 mx-auto text-rose-400" />
          <p className="text-sm font-semibold">{error}</p>
          <button
            onClick={fetchStudents}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl"
          >
            {t(locale, "students.retry")}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && students.length === 0 && (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center text-slate-400 space-y-2">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">
            {search || selectedGroup || selectedStatus
              ? t(locale, "students.emptyListFilter")
              : t(locale, "students.emptyList")}
          </p>
        </div>
      )}

      {/* Content: Responsive Display (Cards on mobile/360px, Table on md+) */}
      {!loading && !error && students.length > 0 && (
        <div className="space-y-4">
          {/* Mobile view (< 640px / 360px) */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {students.map((student) => {
              const activeEnrollments = student.enrollments.filter(
                (e) => e.status === "ACTIVE"
              );
              return (
                <div
                  key={student.id}
                  className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/center/students/${student.id}`}
                        className="font-bold text-white hover:text-brand-400 text-sm block"
                      >
                        {student.user.fullName}
                      </Link>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        {student.user.email}
                      </p>
                      {student.user.phone && (
                        <p className="text-xs text-slate-500 font-mono">
                          {student.user.phone}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        student.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-700/50 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {student.status === "ACTIVE"
                        ? t(locale, "students.statusActive")
                        : t(locale, "students.statusArchived")}
                    </span>
                  </div>

                  {/* Groups badges */}
                  <div className="text-xs text-slate-300">
                    <span className="text-slate-500 font-semibold mr-1.5">
                      {t(locale, "students.groups")}:
                    </span>
                    {activeEnrollments.length > 0 ? (
                      <div className="inline-flex flex-wrap gap-1 mt-1">
                        {activeEnrollments.map((en) => (
                          <span
                            key={en.id}
                            className="px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 text-brand-300 rounded text-[11px]"
                          >
                            {en.group.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">
                        {t(locale, "students.noGroups")}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex justify-end">
                    <Link
                      href={`/center/students/${student.id}`}
                      className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
                    >
                      {t(locale, "students.viewProfile")} &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table view (>= 640px) */}
          <div className="hidden sm:block glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">{t(locale, "students.fullName")}</th>
                    <th className="px-5 py-3.5 font-semibold">{t(locale, "students.email")} / {t(locale, "students.phone")}</th>
                    <th className="px-5 py-3.5 font-semibold">{t(locale, "students.groups")}</th>
                    <th className="px-5 py-3.5 font-semibold">{t(locale, "students.status")}</th>
                    <th className="px-5 py-3.5 font-semibold text-right">{t(locale, "students.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {students.map((student) => {
                    const activeEnrollments = student.enrollments.filter(
                      (e) => e.status === "ACTIVE"
                    );
                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/center/students/${student.id}`}
                            className="font-bold text-white hover:text-brand-400 text-sm"
                          >
                            {student.user.fullName}
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 font-mono">
                          <div>{student.user.email}</div>
                          {student.user.phone && (
                            <div className="text-[11px] text-slate-500">
                              {student.user.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {activeEnrollments.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {activeEnrollments.map((en) => (
                                <span
                                  key={en.id}
                                  className="px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 text-brand-300 rounded text-[11px]"
                                >
                                  {en.group.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">
                              {t(locale, "students.noGroups")}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2.5 py-1 text-[10px] font-semibold rounded-full ${
                              student.status === "ACTIVE"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-700/50 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {student.status === "ACTIVE"
                              ? t(locale, "students.statusActive")
                              : t(locale, "students.statusArchived")}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/center/students/${student.id}`}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all inline-block"
                          >
                            {t(locale, "students.viewProfile")}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                {t(locale, "students.pageOf", { page: String(page), totalPages: String(totalPages) })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-800 space-y-5">
            <h3 className="text-lg font-bold text-white">
              {t(locale, "students.addStudent")}
            </h3>

            {addCreatedCode ? (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3 text-center">
                <UserCheck className="w-8 h-8 mx-auto text-emerald-400" />
                <p className="text-xs font-semibold">
                  {t(locale, "students.studentCreatedInvite")}
                </p>
                <div className="font-mono text-lg font-bold text-white bg-slate-950 p-2 rounded-xl border border-emerald-500/30 select-all">
                  {addCreatedCode}
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setAddCreatedCode(null);
                    setAddFullName("");
                    setAddEmail("");
                    setAddPhone("");
                    setAddGroupId("");
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs"
                >
                  {t(locale, "common.close")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    {t(locale, "students.fullName")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={addFullName}
                    onChange={(e) => setAddFullName(e.target.value)}
                    placeholder="Алишер Навоий"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    {t(locale, "students.email")} *
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="alisher@example.uz"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    {t(locale, "students.phone")}
                  </label>
                  <input
                    type="tel"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="+998901234567"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    {t(locale, "students.group")}
                  </label>
                  <select
                    value={addGroupId}
                    onChange={(e) => setAddGroupId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                  >
                    <option value="">{t(locale, "students.noGroupSelected")}</option>
                    {initialGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="withInvite"
                    checked={addWithInvite}
                    onChange={(e) => setAddWithInvite(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-0"
                  />
                  <label htmlFor="withInvite" className="text-xs text-slate-300 cursor-pointer">
                    {t(locale, "students.inviteCodeNotice")}
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
                  >
                    {t(locale, "common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-brand-600/30 disabled:opacity-50"
                  >
                    {addLoading ? t(locale, "common.loading") : t(locale, "common.save")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-xl p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-400" />
              <span>{t(locale, "students.importCsv")}</span>
            </h3>

            <p className="text-xs text-slate-400">
              {t(locale, "students.csvHelp")}
            </p>

            <textarea
              rows={6}
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="ФИО, Email, Телефон, ID группы&#10;Jasur Rashidov, jasur@example.uz, +998901234567, &#10;Madina Karimova, madina@example.uz, +998907654321, "
              className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-brand-500"
            />

            {/* Preview Results */}
            {csvPreviewData && !csvResult && (
              <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex gap-4">
                  <span className="text-emerald-400 font-semibold">
                    {t(locale, "students.csvRowsValid", {
                      count: csvPreviewData.validCount,
                    })}
                  </span>
                  {csvPreviewData.errorCount > 0 && (
                    <span className="text-rose-400 font-semibold">
                      {t(locale, "students.csvRowsError", {
                        count: csvPreviewData.errorCount,
                      })}
                    </span>
                  )}
                </div>

                {csvPreviewData.errors.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1 p-2 bg-rose-500/10 rounded border border-rose-500/20 text-rose-300">
                    <p className="font-bold">{t(locale, "students.csvImportErrorsTitle")}:</p>
                    {csvPreviewData.errors.map((err, i) => (
                      <p key={i} className="font-mono text-[11px]">
                        {t(locale, "students.csvErrorRow", {
                          row: String(err.row),
                          error: err.error,
                        })}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Execution Report */}
            {csvResult && (
              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 space-y-2 text-xs">
                <p className="text-emerald-300 font-bold">
                  {t(locale, "students.csvImportSuccess", {
                    count: csvResult.createdCount,
                  })}
                </p>
                {csvResult.errors.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1 p-2 bg-rose-500/10 rounded border border-rose-500/20 text-rose-300">
                    <p className="font-bold">{t(locale, "students.csvImportErrorsTitle")}:</p>
                    {csvResult.errors.map((err, i) => (
                      <p key={i} className="font-mono text-[11px]">
                        {t(locale, "students.csvErrorRow", {
                          row: String(err.row),
                          error: err.error,
                        })}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
              >
                {t(locale, "common.close")}
              </button>

              <div className="flex gap-2">
                {!csvResult && (
                  <>
                    <button
                      type="button"
                      disabled={csvLoading || !csvContent.trim()}
                      onClick={handleCsvPreview}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 disabled:opacity-50"
                    >
                      {t(locale, "students.csvPreview")}
                    </button>
                    <button
                      type="button"
                      disabled={csvLoading || !csvPreviewData || csvPreviewData.validCount === 0}
                      onClick={handleCsvExecute}
                      className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-brand-600/30 disabled:opacity-50"
                    >
                      {csvLoading ? t(locale, "common.loading") : t(locale, "common.submit")}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
