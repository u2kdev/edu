"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import { AlertTriangle, X } from "lucide-react";
import { t } from "@/i18n";
import {
  DAYS_OF_WEEK,
  type ScheduleFormData,
  type ScheduleGroupOption,
  type ScheduleSlotItem,
  type ScheduleTeacherOption,
} from "./schedule-utils";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white">
            {editingSlot
              ? t(locale, "schedule.editSlot")
              : t(locale, "schedule.addSlot")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">{errorMsg}</div>
              {conflictList.length > 0 && (
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {conflictList.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 text-xs">
          {/* Group */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              {t(locale, "schedule.group")}
            </label>
            <select
              value={formData.groupId}
              onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
              required
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Teacher */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              {t(locale, "schedule.teacher")}
            </label>
            <select
              value={formData.teacherMembershipId}
              onChange={(e) =>
                setFormData({ ...formData, teacherMembershipId: e.target.value })
              }
              required
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            >
              {teachers.map((teach) => (
                <option key={teach.id} value={teach.id}>
                  {teach.user.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Day of Week */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              {t(locale, "schedule.dayOfWeek")}
            </label>
            <select
              value={formData.dayOfWeek}
              onChange={(e) =>
                setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })
              }
              required
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            >
              {DAYS_OF_WEEK.map((d) => (
                <option key={d} value={d}>
                  {dayNamesFull[d]}
                </option>
              ))}
            </select>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t(locale, "schedule.startTime")}
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                {t(locale, "schedule.endTime")}
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Room */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              {t(locale, "schedule.room")}
            </label>
            <input
              type="text"
              value={formData.roomName}
              onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
              placeholder={t(locale, "schedule.roomPlaceholder")}
              className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Status and Cancellation Reason (when editing) */}
          {editingSlot && (
            <>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t(locale, "schedule.status")}
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="ACTIVE">{t(locale, "schedule.active")}</option>
                  <option value="CANCELLED">{t(locale, "schedule.cancelled")}</option>
                </select>
              </div>

              {formData.status === "CANCELLED" && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {t(locale, "schedule.cancelledReason")}
                  </label>
                  <input
                    type="text"
                    value={formData.cancelledReason}
                    onChange={(e) =>
                      setFormData({ ...formData, cancelledReason: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}
            </>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 font-semibold transition-colors"
            >
              {t(locale, "schedule.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50"
            >
              {submitting ? t(locale, "schedule.loading") : t(locale, "schedule.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
