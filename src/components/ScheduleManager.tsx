"use client";

import { CalendarDays } from "lucide-react";
import { t } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
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
    deleteTargetId,
    setDeleteTargetId,
    deleting,
    deleteError,
    openCreateModal,
    openEditModal,
    handleSaveSlot,
    handleDeleteSlot,
    confirmDeleteSlot,
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

      {deleteError && (
        <Alert variant="destructive">
          <AlertDescription>{deleteError}</AlertDescription>
        </Alert>
      )}

      {/* Main Calendar View Area */}
      {filteredSlots.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          title={t(locale, "schedule.emptyTitle")}
          description={t(locale, "schedule.emptySubtitle")}
        />
      ) : (
        <>
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

          {viewMode === "week" && (
            <ScheduleWeekView
              locale={locale}
              canManage={canManage}
              slotsByDay={slotsByDay}
              dayNamesShort={dayNamesShort}
              onEditSlot={openEditModal}
            />
          )}

          {viewMode === "month" && (
            <ScheduleMonthView slotsByDay={slotsByDay} dayNamesShort={dayNamesShort} />
          )}
        </>
      )}

      {upcomingLessons.length > 0 && (
        <UpcomingLessons lessons={upcomingLessons} locale={locale} />
      )}

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

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title={t(locale, "common.delete")}
        description={t(locale, "schedule.confirmDelete")}
        confirmLabel={t(locale, "common.delete")}
        cancelLabel={t(locale, "common.cancel")}
        variant="destructive"
        loading={deleting}
        onConfirm={confirmDeleteSlot}
      />
    </div>
  );
}
