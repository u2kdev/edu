"use client";

import { t } from "@/i18n";
import { DAYS_OF_WEEK, type ScheduleSlotItem } from "./schedule-utils";
import { ScheduleSlotCard } from "./ScheduleSlotCard";

interface ScheduleDayViewProps {
  locale: string;
  canManage: boolean;
  slotsByDay: Record<number, ScheduleSlotItem[]>;
  selectedDay: number;
  dayNamesFull: Record<number, string>;
  onSelectDay: (day: number) => void;
  onEditSlot: (slot: ScheduleSlotItem) => void;
  onDeleteSlot: (id: string) => void;
}

export function ScheduleDayView({
  locale,
  canManage,
  slotsByDay,
  selectedDay,
  dayNamesFull,
  onSelectDay,
  onEditSlot,
  onDeleteSlot,
}: ScheduleDayViewProps) {
  return (
    <div className="space-y-4">
      {/* Day selection tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
        {DAYS_OF_WEEK.map((day) => (
          <button
            key={day}
            onClick={() => onSelectDay(day)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${
              selectedDay === day
                ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {dayNamesFull[day]} ({slotsByDay[day].length})
          </button>
        ))}
      </div>

      {/* Slots for selected day */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
        {slotsByDay[selectedDay].length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {t(locale, "schedule.noClasses")}
          </div>
        ) : (
          slotsByDay[selectedDay].map((slot) => (
            <ScheduleSlotCard
              key={slot.id}
              slot={slot}
              locale={locale}
              canManage={canManage}
              onEdit={onEditSlot}
              onDelete={onDeleteSlot}
            />
          ))
        )}
      </div>
    </div>
  );
}
