"use client";

import { CalendarDays } from "lucide-react";
import { t } from "@/i18n";
import {
  buildDayNamesFull,
  buildDayNamesShort,
  type ScheduleSlotItem,
  type UpcomingLessonItem,
} from "./schedule/schedule-utils";
import { useSchedule } from "./schedule/use-schedule";
import { ScheduleToolbar } from "./schedule/ScheduleToolbar";
import { ScheduleDayView } from "./schedule/ScheduleDayView";
import { ScheduleWeekView } from "./schedule/ScheduleWeekView";
import { ScheduleMonthView } from "./schedule/ScheduleMonthView";
import { UpcomingLessons } from "./schedule/UpcomingLessons";
import { ScheduleSlotModal } from "./schedule/ScheduleSlotModal";

export type { ScheduleSlotItem, UpcomingLessonItem } from "./schedule/schedule-utils";

interface ScheduleManagerProps {
  initialSlots: ScheduleSlotItem[];
  upcomingLessons: UpcomingLessonItem[];
  groups: { id: string; name: string }[];
  teachers: { id: string; user: { fullName: string } }[];
  userRole: string;
  locale: string;
}

export default function ScheduleManager({
  initialSlots,
  upcomingLessons,
  groups,
  teachers,
  userRole,
  locale,
}: ScheduleManagerProps) {
  const {
    viewMode,
    setViewMode,
    selectedDay,
    setSelectedDay,
    selectedGroupId,
    setSelectedGroupId,
    selectedTeacherId,
    setSelectedTeacherId,
    searchQuery,
    setSearchQuery,
    filteredSlots,
    slotsByDay,
    isModalOpen,
    setIsModalOpen,
    editingSlot,
    formData,
    setFormData,
    errorMsg,
    conflictList,
    submitting,
    openCreateModal,
    openEditModal,
    handleSaveSlot,
    handleDeleteSlot,
  } = useSchedule({ initialSlots, groups, teachers, locale });

  const canManage = userRole === "DIRECTOR" || userRole === "CENTER_ADMIN";

  const dayNamesShort = buildDayNamesShort(locale);
  const dayNamesFull = buildDayNamesFull(locale);

  return (
    <div className="space-y-6">
      <ScheduleToolbar
        locale={locale}
        canManage={canManage}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedGroupId={selectedGroupId}
        onSelectedGroupIdChange={setSelectedGroupId}
        selectedTeacherId={selectedTeacherId}
        onSelectedTeacherIdChange={setSelectedTeacherId}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        groups={groups}
        teachers={teachers}
        onCreateSlot={openCreateModal}
      />

      {/* Main Calendar View Area */}
      {filteredSlots.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center">
          <CalendarDays className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-1">
            {t(locale, "schedule.emptyTitle")}
          </h3>
          <p className="text-sm text-slate-500">
            {t(locale, "schedule.emptySubtitle")}
          </p>
        </div>
      ) : (
        <>
          {/* DAY VIEW */}
          {viewMode === "day" && (
            <ScheduleDayView
              locale={locale}
              canManage={canManage}
              slotsByDay={slotsByDay}
              selectedDay={selectedDay}
              dayNamesFull={dayNamesFull}
              onSelectDay={setSelectedDay}
              onEditSlot={openEditModal}
              onDeleteSlot={handleDeleteSlot}
            />
          )}

          {/* WEEK VIEW */}
          {viewMode === "week" && (
            <ScheduleWeekView
              locale={locale}
              canManage={canManage}
              slotsByDay={slotsByDay}
              dayNamesShort={dayNamesShort}
              onEditSlot={openEditModal}
            />
          )}

          {/* MONTH VIEW */}
          {viewMode === "month" && (
            <ScheduleMonthView slotsByDay={slotsByDay} dayNamesShort={dayNamesShort} />
          )}
        </>
      )}

      {/* UPCOMING ONE-TIME LESSONS (if any) */}
      {upcomingLessons.length > 0 && (
        <UpcomingLessons lessons={upcomingLessons} locale={locale} />
      )}

      {/* CREATE / EDIT SLOT MODAL */}
      {isModalOpen && (
        <ScheduleSlotModal
          locale={locale}
          editingSlot={editingSlot}
          formData={formData}
          setFormData={setFormData}
          errorMsg={errorMsg}
          conflictList={conflictList}
          submitting={submitting}
          groups={groups}
          teachers={teachers}
          dayNamesFull={dayNamesFull}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSaveSlot}
        />
      )}
    </div>
  );
}
