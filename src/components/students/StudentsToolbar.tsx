"use client";

import { Filter, Plus, Search, Upload, Users } from "lucide-react";
import { t } from "@/i18n";
import { sortSelectValue, type GroupOption } from "./students-utils";

interface StudentsToolbarProps {
  locale: string;
  canManage: boolean;
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  selectedGroup: string;
  onGroupChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  sortBy: string;
  sortOrder: string;
  onSortChange: (value: string) => void;
  initialGroups: GroupOption[];
  onOpenAdd: () => void;
  onOpenCsv: () => void;
}

export function StudentsToolbar({
  locale,
  canManage,
  totalCount,
  search,
  onSearchChange,
  selectedGroup,
  onGroupChange,
  selectedStatus,
  onStatusChange,
  sortBy,
  sortOrder,
  onSortChange,
  initialGroups,
  onOpenAdd,
  onOpenCsv,
}: StudentsToolbarProps) {
  return (
    <>
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
              onClick={onOpenCsv}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-2"
            >
              <Upload className="w-3.5 h-3.5 text-slate-400" />
              <span>{t(locale, "students.importCsv")}</span>
            </button>
            <button
              onClick={onOpenAdd}
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
            onChange={(e) => onSearchChange(e.target.value)}
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
              onChange={(e) => onGroupChange(e.target.value)}
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
            onChange={(e) => onStatusChange(e.target.value)}
            className="bg-slate-900 px-3 py-2 rounded-xl border border-slate-700/80 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="" className="bg-slate-900">{t(locale, "students.filterStatus")}</option>
            <option value="ACTIVE" className="bg-slate-900">{t(locale, "students.statusActive")}</option>
            <option value="ARCHIVED" className="bg-slate-900">{t(locale, "students.statusArchived")}</option>
          </select>

          {/* Sorting */}
          <select
            value={sortSelectValue(sortBy, sortOrder)}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-slate-900 px-3 py-2 rounded-xl border border-slate-700/80 text-xs text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="name-asc" className="bg-slate-900">{t(locale, "students.sortName")} ({t(locale, "students.sortAsc")})</option>
            <option value="name-desc" className="bg-slate-900">{t(locale, "students.sortName")} ({t(locale, "students.sortDesc")})</option>
            <option value="createdAt-desc" className="bg-slate-900">{t(locale, "students.sortDate")} ({t(locale, "students.sortNewest")})</option>
            <option value="createdAt-asc" className="bg-slate-900">{t(locale, "students.sortDate")} ({t(locale, "students.sortOldest")})</option>
          </select>
        </div>
      </div>
    </>
  );
}
