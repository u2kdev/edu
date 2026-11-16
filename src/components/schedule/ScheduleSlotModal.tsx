"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { t } from "@/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormActions, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  DAYS_OF_WEEK,
  type ScheduleFormData,
  type ScheduleGroupOption,
  type ScheduleSlotItem,
  type ScheduleTeacherOption,
} from "./schedule-utils";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

interface ScheduleSlotModalProps {
  locale: string;
  editingSlot: ScheduleSlotItem | null;
  formData: ScheduleFormData;
  setFormData: Dispatch<SetStateAction<ScheduleFormData>>;
  errorMsg: string;
  conflictList: string[];
  submitting: boolean;
  groups: ScheduleGroupOption[];
  teachers: ScheduleTeacherOption[];
  dayNamesFull: Record<number, string>;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}

export function ScheduleSlotModal({
  locale,
  editingSlot,
  formData,
  setFormData,
  errorMsg,
  conflictList,
  submitting,
  groups,
  teachers,
  dayNamesFull,
  onClose,
  onSubmit,
}: ScheduleSlotModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingSlot
              ? t(locale, "schedule.editSlot")
              : t(locale, "schedule.addSlot")}
          </DialogTitle>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertTitle>{errorMsg}</AlertTitle>
            {conflictList.length > 0 && (
              <AlertDescription>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {conflictList.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </AlertDescription>
            )}
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label={t(locale, "schedule.group")} htmlFor="sched-group" required>
            <select
              id="sched-group"
              value={formData.groupId}
              onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
              required
              className={SELECT_CLS}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t(locale, "schedule.teacher")} htmlFor="sched-teacher" required>
            <select
              id="sched-teacher"
              value={formData.teacherMembershipId}
              onChange={(e) =>
                setFormData({ ...formData, teacherMembershipId: e.target.value })
              }
              required
              className={SELECT_CLS}
            >
              {teachers.map((teach) => (
                <option key={teach.id} value={teach.id}>
                  {teach.user.fullName}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label={t(locale, "schedule.dayOfWeek")} htmlFor="sched-day" required>
            <select
              id="sched-day"
              value={formData.dayOfWeek}
              onChange={(e) =>
                setFormData({ ...formData, dayOfWeek: parseInt(e.target.value, 10) })
              }
              required
              className={SELECT_CLS}
            >
              {DAYS_OF_WEEK.map((d) => (
                <option key={d} value={d}>
                  {dayNamesFull[d]}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label={t(locale, "schedule.startTime")} htmlFor="sched-start" required>
              <Input
                id="sched-start"
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
              />
            </FormField>
            <FormField label={t(locale, "schedule.endTime")} htmlFor="sched-end" required>
              <Input
                id="sched-end"
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
              />
            </FormField>
          </div>

          <FormField label={t(locale, "schedule.room")} htmlFor="sched-room">
            <Input
              id="sched-room"
              type="text"
              value={formData.roomName}
              onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
              placeholder={t(locale, "schedule.roomPlaceholder")}
            />
          </FormField>

          {editingSlot && (
            <>
              <FormField label={t(locale, "schedule.status")} htmlFor="sched-status">
                <select
                  id="sched-status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={SELECT_CLS}
                >
                  <option value="ACTIVE">{t(locale, "schedule.active")}</option>
                  <option value="CANCELLED">{t(locale, "schedule.cancelled")}</option>
                </select>
              </FormField>

              {formData.status === "CANCELLED" && (
                <FormField label={t(locale, "schedule.cancelledReason")} htmlFor="sched-reason">
                  <Input
                    id="sched-reason"
                    type="text"
                    value={formData.cancelledReason}
                    onChange={(e) =>
                      setFormData({ ...formData, cancelledReason: e.target.value })
                    }
                  />
                </FormField>
              )}
            </>
          )}

          <FormActions>
            <Button type="button" variant="outline" onClick={onClose}>
              {t(locale, "schedule.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t(locale, "schedule.loading") : t(locale, "schedule.save")}
            </Button>
          </FormActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
