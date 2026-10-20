"use client";

import type { FormEvent } from "react";
import { UserCheck } from "lucide-react";
import { t } from "@/i18n";
import type { GroupOption } from "./students-utils";

interface StudentFormModalProps {
  locale: string;
  initialGroups: GroupOption[];
  namePlaceholder: string;
  fullName: string;
  onFullNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  groupId: string;
  onGroupIdChange: (value: string) => void;
  withInvite: boolean;
  onWithInviteChange: (value: boolean) => void;
  submitting: boolean;
  createdCode: string | null;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  onCloseWithReset: () => void;
}

export function StudentFormModal({
  locale,
  initialGroups,
  namePlaceholder,
  fullName,
  onFullNameChange,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  groupId,
  onGroupIdChange,
  withInvite,
  onWithInviteChange,
  submitting,
  createdCode,
  onSubmit,
  onClose,
  onCloseWithReset,
}: StudentFormModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-800 space-y-5">
        <h3 className="text-lg font-bold text-white">
          {t(locale, "students.addStudent")}
        </h3>

        {createdCode ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-3 text-center">
            <UserCheck className="w-8 h-8 mx-auto text-emerald-400" />
            <p className="text-xs font-semibold">
              {t(locale, "students.studentCreatedInvite")}
            </p>
            <div className="font-mono text-lg font-bold text-white bg-slate-950 p-2 rounded-xl border border-emerald-500/30 select-all">
              {createdCode}
            </div>
            <button
              onClick={onCloseWithReset}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs"
            >
              {t(locale, "common.close")}
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {t(locale, "students.fullName")} *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => onFullNameChange(e.target.value)}
                placeholder={namePlaceholder}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {t(locale, "students.email")} *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="alisher@example.uz"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {t(locale, "students.phone")}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                placeholder="+998901234567"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {t(locale, "students.group")}
              </label>
              <select
                value={groupId}
                onChange={(e) => onGroupIdChange(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="">{t(locale, "students.noGroupSelected")}</option>
                {initialGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="withInvite"
                checked={withInvite}
                onChange={(e) => onWithInviteChange(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-0"
              />
              <label htmlFor="withInvite" className="text-xs text-slate-300 cursor-pointer">
                {t(locale, "students.inviteCodeNotice")}
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
              >
                {t(locale, "common.cancel")}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-brand-600/30 disabled:opacity-50"
              >
                {submitting ? t(locale, "common.loading") : t(locale, "common.save")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
