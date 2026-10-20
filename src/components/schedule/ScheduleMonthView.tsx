"use client";

import { DAYS_OF_WEEK, type ScheduleSlotItem } from "./schedule-utils";

interface ScheduleMonthViewProps {
  slotsByDay: Record<number, ScheduleSlotItem[]>;
  dayNamesShort: Record<number, string>;
}

export function ScheduleMonthView({ slotsByDay, dayNamesShort }: ScheduleMonthViewProps) {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
      <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-slate-400 pb-2 border-b border-slate-800">
        {DAYS_OF_WEEK.map((d) => (
          <div key={d}>{dayNamesShort[d]}</div>
        ))}
      </div>

      {/* 4-week calendar simulation based on active recurring slots */}
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 28 }).map((_, idx) => {
          const dayOfWeek = (idx % 7) + 1;
          const daySlots = slotsByDay[dayOfWeek];
          const dayNumber = idx + 1;

          return (
            <div
              key={idx}
              className="min-h-[85px] p-1.5 bg-slate-900/40 rounded-xl border border-slate-800/60 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                <span>{dayNumber}</span>
                {daySlots.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                )}
              </div>

              <div className="space-y-1">
                {daySlots.slice(0, 2).map((slot) => (
                  <div
                    key={slot.id}
                    className="px-1.5 py-0.5 rounded text-[9px] font-semibold truncate bg-brand-500/10 text-brand-300 border border-brand-500/20"
                  >
                    {slot.startTime} {slot.group.name}
                  </div>
                ))}
                {daySlots.length > 2 && (
                  <div className="text-[8px] text-slate-500 text-center font-medium">
                    +{daySlots.length - 2}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
