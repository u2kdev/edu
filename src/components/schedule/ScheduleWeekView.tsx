"use client";

import { Clock, Edit2 } from "lucide-react";
import { t } from "@/i18n";
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
    <div className="glass-panel p-5 rounded-2xl border border-slate-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="min-h-[140px] bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/80"
          >
            <div
              className={`text-center text-xs font-bold uppercase tracking-wider mb-2.5 pb-1.5 border-b ${
                day === 6 || day === 7
                  ? "text-amber-400 border-amber-500/30"
                  : "text-slate-400 border-slate-800"
              }`}
            >
              {dayNamesShort[day]}
            </div>

            <div className="space-y-2">
              {slotsByDay[day].length === 0 ? (
                <div className="text-center text-[10px] text-slate-700 pt-6">
                  —
                </div>
              ) : (
                slotsByDay[day].map((slot) => (
                  <div
                    key={slot.id}
                    className={`p-2.5 rounded-xl border text-xs relative group transition-all ${
                      slot.status === "CANCELLED"
                        ? "bg-rose-500/5 border-rose-500/20 opacity-75"
                        : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-[11px] truncate">
                        {slot.group.name}
                      </span>
                      {canManage && (
                        <button
                          onClick={() => onEditSlot(slot)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-white transition-opacity"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="text-brand-400 font-semibold text-[10px] mt-1 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {slot.startTime}–{slot.endTime}
                    </div>

                    <div className="text-slate-400 text-[10px] truncate mt-0.5">
                      {slot.teacher.user.fullName}
                    </div>

                    {slot.roomName && (
                      <div className="text-slate-500 text-[9px] truncate mt-0.5">
                        {slot.roomName}
                      </div>
                    )}

                    {slot.status === "CANCELLED" && (
                      <div className="text-rose-400 text-[9px] font-semibold mt-1">
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
    </div>
  );
}
