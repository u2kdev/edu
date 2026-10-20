"use client";

import { CalendarDays, Download, Plus, Search } from "lucide-react";
import { t } from "@/i18n";
import type { ScheduleGroupOption, ScheduleTeacherOption, ScheduleViewMode } from "./schedule-utils";

interface ScheduleToolbarProps {
  locale: string;
  canManage: boolean;
  viewMode: ScheduleViewMode;
  onViewModeChange: (mode: ScheduleViewMode) => void;
  selectedGroupId: string;
  onSelectedGroupIdChange: (value: string) => void;
  selectedTeacherId: string;
  onSelectedTeacherIdChange: (value: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  groups: ScheduleGroupOption[];
  teachers: ScheduleTeacherOption[];
  onCreateSlot: () => void;
}

export function ScheduleToolbar({
  locale,
  canManage,
  viewMode,
  onViewModeChange,
  selectedGroupId,
  onSelectedGroupIdChange,
  selectedTeacherId,
  onSelectedTeacherIdChange,
  searchQuery,
  onSearchQueryChange,
  groups,
  teachers,
  onCreateSlot,
}: ScheduleToolbarProps) {
  return (
    <>
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-brand-400" />
            {t(locale, "schedule.title")}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {t(locale, "schedule.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* iCal Export */}
          <a
            href={`/api/schedule/ical${selectedGroupId ? `?groupId=${selectedGroupId}` : ""}`}
            download="schedule.ics"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
          >
            <Download className="w-4 h-4 text-brand-400" />
            {t(locale, "schedule.exportIcal")}
          </a>

          {/* Add Slot (Admin/Director) */}
          {canManage && (
            <button
              onClick={onCreateSlot}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              {t(locale, "schedule.addSlot")}
            </button>
          )}
        </div>
      </div>

      {/* View Switcher & Filters */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => onViewModeChange("day")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === "day"
                ? "bg-brand-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t(locale, "schedule.dayView")}
          </button>
          <button
            onClick={() => onViewModeChange("week")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === "week"
                ? "bg-brand-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t(locale, "schedule.weekView")}
          </button>
          <button
            onClick={() => onViewModeChange("month")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === "month"
                ? "bg-brand-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t(locale, "schedule.monthView")}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={t(locale, "schedule.searchPlaceholder")}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Group Filter */}
          <select
            value={selectedGroupId}
            onChange={(e) => onSelectedGroupIdChange(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">{t(locale, "schedule.allGroups")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {/* Teacher Filter */}
          <select
            value={selectedTeacherId}
            onChange={(e) => onSelectedTeacherIdChange(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">{t(locale, "schedule.allTeachers")}</option>
            {teachers.map((teach) => (
              <option key={teach.id} value={teach.id}>
                {teach.user.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
