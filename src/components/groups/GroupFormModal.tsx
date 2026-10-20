"use client";

import type { FormEvent } from "react";
import { t } from "@/i18n";
import type { CourseOption, TeacherOption } from "./groups-utils";

interface CreateGroupModalProps {
  locale: string;
  courses: CourseOption[];
  teachers: TeacherOption[];
  namePlaceholder: string;
  courseId: string;
  onCourseIdChange: (value: string) => void;
  name: string;
  onNameChange: (value: string) => void;
  teacherMembershipId: string;
  onTeacherMembershipIdChange: (value: string) => void;
  maxStudents: string;
  onMaxStudentsChange: (value: string) => void;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function CreateGroupModal({
  locale,
  courses,
  teachers,
  namePlaceholder,
  courseId,
  onCourseIdChange,
  name,
  onNameChange,
  teacherMembershipId,
  onTeacherMembershipIdChange,
  maxStudents,
  onMaxStudentsChange,
  loading,
  onSubmit,
  onClose,
}: CreateGroupModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
        <h3 className="text-xl font-bold text-white">
          {t(locale, "groups.createGroup")}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "groups.selectCourse")}
            </label>
            <select
              required
              value={courseId}
              onChange={(e) => onCourseIdChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "groups.groupName")}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={namePlaceholder}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "groups.assignTeacher")}
            </label>
            <select
              value={teacherMembershipId}
              onChange={(e) => onTeacherMembershipIdChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            >
              <option value="">{t(locale, "groups.noTeacher")}</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.user.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "groups.maxStudents")}
            </label>
            <input
              type="number"
              min="1"
              max="200"
              required
              value={maxStudents}
              onChange={(e) => onMaxStudentsChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
            >
              {t(locale, "common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand-600/30"
            >
              {loading ? t(locale, "common.loading") : t(locale, "groups.createGroup")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditGroupModalProps {
  locale: string;
  teachers: TeacherOption[];
  name: string;
  onNameChange: (value: string) => void;
  teacherMembershipId: string;
  onTeacherMembershipIdChange: (value: string) => void;
  maxStudents: string;
  onMaxStudentsChange: (value: string) => void;
  loading: boolean;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}

export function EditGroupModal({
  locale,
  teachers,
  name,
  onNameChange,
  teacherMembershipId,
  onTeacherMembershipIdChange,
  maxStudents,
  onMaxStudentsChange,
  loading,
  onSubmit,
  onClose,
}: EditGroupModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
        <h3 className="text-xl font-bold text-white">
          {t(locale, "groups.editGroup")}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "groups.groupName")}
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "groups.assignTeacher")}
            </label>
            <select
              value={teacherMembershipId}
              onChange={(e) => onTeacherMembershipIdChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            >
              <option value="">{t(locale, "groups.noTeacher")}</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.user.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t(locale, "groups.maxStudents")}
            </label>
            <input
              type="number"
              min="1"
              max="200"
              required
              value={maxStudents}
              onChange={(e) => onMaxStudentsChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
            >
              {t(locale, "common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand-600/30"
            >
              {loading ? t(locale, "common.loading") : t(locale, "common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
