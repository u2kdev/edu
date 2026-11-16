"use client";

import { Clock, Edit2 } from "lucide-react";
import { t } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { DAYS_OF_WEEK, type ScheduleSlotItem } from "./schedule-utils";

interface ScheduleWeekViewProps {
  locale: string;
  canManage: boolean;
  slotsByDay: Record<number, ScheduleSlotItem[]>;
  dayNamesShort: Record<number, string>;
  onEditSlot: (slot: ScheduleSlotItem) => void;
}

export function ScheduleWeekView({
  locale,
  canManage,
  slotsByDay,
  dayNamesShort,
  onEditSlot,
}: ScheduleWeekViewProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="min-h-[140px] rounded-lg border border-border bg-muted/40 p-2.5"
            >
              <div
                className={`mb-2.5 border-b pb-1.5 text-center text-xs font-semibold ${
                  day === 6 || day === 7
                    ? "border-warning/30 text-warning"
                    : "border-border text-muted-foreground"
                }`}
              >
                {dayNamesShort[day]}
              </div>

              <div className="space-y-2">
                {slotsByDay[day].length === 0 ? (
                  <div className="pt-6 text-center text-xs text-muted-foreground">—</div>
                ) : (
                  slotsByDay[day].map((slot) => (
                    <div
                      key={slot.id}
                      className={`group relative rounded-md border p-2.5 text-xs transition-colors ${
                        slot.status === "CANCELLED"
                          ? "border-destructive/30 bg-destructive-subtle/40 opacity-80"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-semibold text-foreground">
                          {slot.group.name}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            aria-label={t(locale, "common.edit")}
                            onClick={() => onEditSlot(slot)}
                            className="p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <Edit2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-1 text-xs font-medium text-primary tabular-nums">
                        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>
                          {slot.startTime}–{slot.endTime}
                        </span>
                      </div>

                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {slot.teacher.user.fullName}
                      </div>

                      {slot.roomName && (
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {slot.roomName}
                        </div>
                      )}

                      {slot.status === "CANCELLED" && (
                        <div className="mt-1 text-xs font-medium text-destructive">
                          {t(locale, "schedule.cancelled")}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
