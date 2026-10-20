"use client";

import { BookOpen, Edit2, MapPin, Trash2, UserCheck } from "lucide-react";
import { t } from "@/i18n";
import type { ScheduleSlotItem } from "./schedule-utils";

interface ScheduleSlotCardProps {
  slot: ScheduleSlotItem;
  locale: string;
  canManage: boolean;
  onEdit: (slot: ScheduleSlotItem) => void;
  onDelete: (id: string) => void;
}

export function ScheduleSlotCard({
  slot,
  locale,
  canManage,
  onEdit,
  onDelete,
}: ScheduleSlotCardProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-900/40 transition-colors gap-3">
      <div className="flex items-start gap-4">
        <div className="text-center w-16 shrink-0">
          <div className="text-sm font-bold text-brand-400">
            {slot.startTime}
          </div>
          <div className="text-xs text-slate-500">{slot.endTime}</div>
        </div>

        <div
          className="w-1.5 h-12 rounded-full shrink-0"
          style={{
            backgroundColor: slot.group.subject?.color || "#4f6ef7",
          }}
        />

        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">
              {slot.group.name}
            </span>
            {slot.status === "CANCELLED" && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {t(locale, "schedule.cancelled")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              {slot.group.course.title}
            </span>
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              {slot.teacher.user.fullName}
            </span>
            {slot.roomName && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {slot.roomName}
              </span>
            )}
          </div>
          {slot.cancelledReason && (
            <p className="text-xs text-rose-400 mt-1 italic">
              {t(locale, "schedule.cancelledReason")}: {slot.cancelledReason}
            </p>
          )}
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => onEdit(slot)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(slot.id)}
            className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
