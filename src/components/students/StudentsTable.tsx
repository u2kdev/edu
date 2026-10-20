"use client";

import Link from "next/link";
import { t } from "@/i18n";
import {
  activeEnrollments,
  studentStatusBadgeTone,
  studentStatusLabel,
  type StudentItem,
} from "./students-utils";

interface StudentsTableProps {
  students: StudentItem[];
  locale: string;
}

export function StudentsTable({ students, locale }: StudentsTableProps) {
  return (
    <div className="hidden sm:block glass-panel rounded-2xl border border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
            <tr>
              <th className="px-5 py-3.5 font-semibold">{t(locale, "students.fullName")}</th>
              <th className="px-5 py-3.5 font-semibold">{t(locale, "students.email")} / {t(locale, "students.phone")}</th>
              <th className="px-5 py-3.5 font-semibold">{t(locale, "students.groups")}</th>
              <th className="px-5 py-3.5 font-semibold">{t(locale, "students.status")}</th>
              <th className="px-5 py-3.5 font-semibold text-right">{t(locale, "students.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {students.map((student) => {
              const enrollments = activeEnrollments(student);
              return (
                <tr
                  key={student.id}
                  className="hover:bg-slate-900/40 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/center/students/${student.id}`}
                      className="font-bold text-white hover:text-brand-400 text-sm"
                    >
                      {student.user.fullName}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 font-mono">
                    <div>{student.user.email}</div>
                    {student.user.phone && (
                      <div className="text-[11px] text-slate-500">
                        {student.user.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {enrollments.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {enrollments.map((en) => (
                          <span
                            key={en.id}
                            className="px-2 py-0.5 bg-brand-500/10 border border-brand-500/20 text-brand-300 rounded text-[11px]"
                          >
                            {en.group.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">
                        {t(locale, "students.noGroups")}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`px-2.5 py-1 text-[10px] font-semibold rounded-full ${studentStatusBadgeTone(
                        student.status
                      )}`}
                    >
                      {studentStatusLabel(locale, student.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/center/students/${student.id}`}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-all inline-block"
                    >
                      {t(locale, "students.viewProfile")}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
