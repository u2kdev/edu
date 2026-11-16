"use client";

import { BookOpen, Edit2, MapPin, Trash2, UserCheck } from "lucide-react";
import { t } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center">
      <div className="flex items-start gap-4">
        <div className="w-16 shrink-0 text-center tabular-nums">
          <div className="text-sm font-semibold text-primary">{slot.startTime}</div>
          <div className="text-xs text-muted-foreground">{slot.endTime}</div>
        </div>

        <div className="h-12 w-1 shrink-0 rounded-full bg-primary/50" aria-hidden="true" />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{slot.group.name}</span>
            {slot.status === "CANCELLED" && (
              <Badge variant="destructive">{t(locale, "schedule.cancelled")}</Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              {slot.group.course.title}
            </span>
            <span className="flex items-center gap-1">
              <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {slot.teacher.user.fullName}
            </span>
            {slot.roomName && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {slot.roomName}
              </span>
            )}
          </div>
          {slot.cancelledReason && (
            <p className="mt-1 text-xs italic text-destructive">
              {t(locale, "schedule.cancelledReason")}: {slot.cancelledReason}
            </p>
          )}
        </div>
      </div>

      {canManage && (
        <div className="flex items-center gap-1.5 self-end sm:self-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t(locale, "common.edit")}
            title={t(locale, "common.edit")}
            onClick={() => onEdit(slot)}
          >
            <Edit2 className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t(locale, "common.delete")}
            title={t(locale, "common.delete")}
            onClick={() => onDelete(slot.id)}
          >
            <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
