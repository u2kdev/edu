"use client";

import { Card, CardContent } from "@/components/ui/card";
import { DAYS_OF_WEEK, type ScheduleSlotItem } from "./schedule-utils";

interface ScheduleMonthViewProps {
  slotsByDay: Record<number, ScheduleSlotItem[]>;
  dayNamesShort: Record<number, string>;
}

export function ScheduleMonthView({ slotsByDay, dayNamesShort }: ScheduleMonthViewProps) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-7 gap-1.5 border-b border-border pb-2 text-center text-xs font-semibold text-muted-foreground">
          {DAYS_OF_WEEK.map((d) => (
            <div key={d}>{dayNamesShort[d]}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 28 }).map((_, idx) => {
            const dayOfWeek = (idx % 7) + 1;
            const daySlots = slotsByDay[dayOfWeek];
            const dayNumber = idx + 1;

            return (
              <div
                key={idx}
                className="flex min-h-[85px] flex-col justify-between rounded-md border border-border bg-muted/40 p-1.5"
              >
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground tabular-nums">
                  <span>{dayNumber}</span>
                  {daySlots.length > 0 && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                  )}
                </div>

                <div className="space-y-1">
                  {daySlots.slice(0, 2).map((slot) => (
                    <div
                      key={slot.id}
                      className="truncate rounded border border-primary/25 bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground tabular-nums"
                    >
                      {slot.startTime} {slot.group.name}
                    </div>
                  ))}
                  {daySlots.length > 2 && (
                    <div className="text-center text-xs font-medium text-muted-foreground tabular-nums">
                      +{daySlots.length - 2}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
