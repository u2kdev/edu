"use client";

import Link from "next/link";
import { t } from "@/i18n";
import {
  activeEnrollments,
  studentStatusBadgeTone,
  studentStatusLabel,
  type StudentItem,
} from "./students-utils";

interface StudentCardProps {
  student: StudentItem;
  locale: string;
}

export function StudentCard({ student, locale }: StudentCardProps) {
  const enrollments = activeEnrollments(student);

  return (
    <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/center/students/${student.id}`}
            className="font-bold text-white hover:text-brand-400 text-sm block"
          >
            {student.user.fullName}
          </Link>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            {student.user.email}
          </p>
          {student.user.phone && (
            <p className="text-xs text-slate-500 font-mono">
              {student.user.phone}
            </p>
          )}
        </div>
        <span
          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${studentStatusBadgeTone(
            student.status
          )}`}
        >
          {studentStatusLabel(locale, student.status)}
        </span>
      </div>

      {/* Groups badges */}
      <div className="text-xs text-slate-300">
        <span className="text-slate-500 font-semibold mr-1.5">
          {t(locale, "students.groups")}:
        </span>
        {enrollments.length > 0 ? (
          <div className="inline-flex flex-wrap gap-1 mt-1">
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
      </div>

      <div className="pt-2 border-t border-slate-800/80 flex justify-end">
        <Link
          href={`/center/students/${student.id}`}
          className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
        >
          {t(locale, "students.viewProfile")} &rarr;
        </Link>
      </div>
    </div>
  );
}
