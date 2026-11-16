"use client";

import { t } from "@/i18n";
import { Card } from "@/components/ui/card";
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
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {DAYS_OF_WEEK.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onSelectDay(day)}
            className={`shrink-0 rounded-md border px-3.5 py-2 text-xs font-medium transition-colors tabular-nums ${
              selectedDay === day
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {dayNamesFull[day]} ({slotsByDay[day].length})
          </button>
        ))}
      </div>

      <Card className="divide-y divide-border overflow-hidden">
        {slotsByDay[selectedDay].length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
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
      </Card>
    </div>
  );
}
