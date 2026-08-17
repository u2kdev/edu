import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Award, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";

export default async function CenterGradesPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const activeRole = session.activeCenterRole || "";

  // Get the current user's membership in this center
  const currentMembership = session.memberships.find((m) => m.centerId === centerId);

  // SECURITY: Build WHERE clause scoped by role
  // TEACHER: only see grades for students in their own groups
  // STUDENT: only see their own grades
  // DIRECTOR/CENTER_ADMIN: see all center grades
  let submissionsWhere: any = {
    homework: { lesson: { module: { course: { centerId } } } },
    grade: { not: null },
  };
  let testAttemptsWhere: any = {
    test: { material: { centerId } },
  };

  if (activeRole === "TEACHER" && currentMembership) {
    // Scope to groups where this teacher is assigned
    submissionsWhere = {
      homework: { lesson: { module: { course: { centerId } } } },
      grade: { not: null },
      student: {
        enrollments: {
          some: {
            group: { teacherMembershipId: currentMembership.id },
          },
        },
      },
    };
    testAttemptsWhere = {
      test: { material: { centerId } },
      student: {
        enrollments: {
          some: {
            group: { teacherMembershipId: currentMembership.id },
          },
        },
      },
    };
  } else if (activeRole === "STUDENT" && currentMembership) {
    // Students only see their own grades
    submissionsWhere = {
      homework: { lesson: { module: { course: { centerId } } } },
      grade: { not: null },
      studentMembershipId: currentMembership.id,
    };
    testAttemptsWhere = {
      test: { material: { centerId } },
      studentMembershipId: currentMembership.id,
    };
  } else if (activeRole === "PARENT" && currentMembership) {
    // Parents see grades for their confirmed children
    const childLinks = await db.parentLink.findMany({
      where: { parentMembershipId: currentMembership.id, status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    const childIds = childLinks.map((l) => l.studentMembershipId);
    submissionsWhere = {
      homework: { lesson: { module: { course: { centerId } } } },
      grade: { not: null },
      studentMembershipId: { in: childIds },
    };
    testAttemptsWhere = {
      test: { material: { centerId } },
      studentMembershipId: { in: childIds },
    };
  }

  const submissions = await db.homeworkSubmission.findMany({
    where: submissionsWhere,
    include: {
      homework: { select: { title: true } },
      student: { include: { user: { select: { fullName: true, email: true } } } },
    },
    orderBy: { gradedAt: "desc" },
    take: 50,
  });

  const testAttempts = await db.testAttempt.findMany({
    where: testAttemptsWhere,
    include: {
      test: { include: { material: { select: { title: true } } } },
      student: { include: { user: { select: { fullName: true, email: true } } } },
    },
    orderBy: { completedAt: "desc" },
    take: 50,
  });

  const totalGraded = submissions.filter((s) => s.grade !== null).length;
  const avgGrade = totalGraded > 0
    ? Math.round(submissions.reduce((sum, s) => sum + (s.grade || 0), 0) / totalGraded)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{t(locale, "nav.grades")}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {activeRole === "TEACHER"
              ? "Оценки учеников ваших групп"
              : activeRole === "STUDENT"
              ? "Ваши оценки"
              : activeRole === "PARENT"
              ? "Оценки ваших детей"
              : "Все оценки учебного центра"}
          </p>
        </div>
        {totalGraded > 0 && (
          <div className="glass-panel px-5 py-3 rounded-2xl border border-slate-800 text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Средний балл</div>
            <div className={`text-2xl font-extrabold mt-0.5 ${avgGrade >= 70 ? "text-emerald-400" : avgGrade >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {avgGrade}%
            </div>
          </div>
        )}
      </div>

      {/* Test Attempts Grades Table */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-brand-400" />
          <span>{t(locale, "materials.testDescription")}</span>
          <span className="ml-auto text-xs font-normal text-slate-500">{testAttempts.length} записей</span>
        </h3>

        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">{t(locale, "nav.students")}</th>
                <th className="p-4">{t(locale, "materials.test")}</th>
                <th className="p-4">{t(locale, "performance.title")} (%)</th>
                <th className="p-4">{t(locale, "common.status")}</th>
                <th className="p-4">{t(locale, "common.date")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {testAttempts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Award className="w-8 h-8 text-slate-700" />
                      <span className="text-slate-500 text-sm">{t(locale, "common.noData")}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                testAttempts.map((att) => {
                  const isPassed = (att.scorePercent || 0) >= att.test.passingScorePercent;
                  return (
                    <tr key={att.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-4 font-semibold text-white">{att.student.user.fullName}</td>
                      <td className="p-4 text-slate-300">{att.test.material.title}</td>
                      <td className="p-4 font-bold text-brand-400">
                        {att.scorePercent}% ({att.scorePoints}/{att.maxPoints})
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isPassed
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}>
                          {isPassed ? "✓ Сдан" : "✗ Не сдан"}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        {formatDateLocalized(att.completedAt, locale)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Homework Grades Table */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-emerald-400" />
          <span>{t(locale, "homework.title")}</span>
          <span className="ml-auto text-xs font-normal text-slate-500">{submissions.length} записей</span>
        </h3>

        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4">{t(locale, "nav.students")}</th>
                <th className="p-4">{t(locale, "homework.title")}</th>
                <th className="p-4">{t(locale, "performance.title")}</th>
                <th className="p-4">Обратная связь</th>
                <th className="p-4">{t(locale, "common.date")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <GraduationCap className="w-8 h-8 text-slate-700" />
                      <span className="text-slate-500 text-sm">{t(locale, "common.noData")}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                submissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-4 font-semibold text-white">{sub.student.user.fullName}</td>
                    <td className="p-4 text-slate-300">{sub.homework.title}</td>
                    <td className="p-4">
                      <span className={`font-bold ${(sub.grade || 0) >= 70 ? "text-emerald-400" : (sub.grade || 0) >= 50 ? "text-amber-400" : "text-red-400"}`}>
                        {sub.grade} / 100
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-xs max-w-xs truncate">
                      {sub.feedback || "—"}
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {formatDateLocalized(sub.gradedAt, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
