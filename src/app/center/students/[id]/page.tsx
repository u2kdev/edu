import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
// Reason: Exception: Server page checks session models and shared rules.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { canManageUserAccount } from "@/lib/tenant-user-guard";
import { getStudentPerformanceData, type StudentPerformanceDTO } from "@/lib/dashboard-analytics";
import { StudentProfileClient } from "@/components/students/StudentProfileClient";
import { t } from "@/i18n";

export default async function StudentProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const studentMembershipId = params.id;
  const currentRole = session.activeCenterRole || "";
  const locale = session.user.preferredLanguage || "ru";

  const tenantDb = tenantCtx.getTenantDb();

  // Find student in this center
  let student = await tenantDb.centerMembership.findFirst({
    where: {
      id: studentMembershipId,
      centerId: tenantCtx.center.id,
      role: "STUDENT",
    },
    include: {
      user: true,
      enrollments: {
        include: {
          group: {
            include: {
              course: { select: { title: true } },
              teacher: {
                include: { user: { select: { fullName: true } } },
              },
            },
          },
        },
        orderBy: { enrolledAt: "desc" },
      },
      parentLinksAsStudent: {
        where: { status: "CONFIRMED" },
        include: {
          parent: {
            include: {
              user: {
                select: { id: true, fullName: true, phone: true, email: true },
              },
            },
          },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!student) {
    student = await tenantDb.centerMembership.findFirst({
      where: {
        userId: studentMembershipId,
        centerId: tenantCtx.center.id,
        role: "STUDENT",
      },
      include: {
        user: true,
        enrollments: {
          include: {
            group: {
              include: {
                course: { select: { title: true } },
                teacher: {
                  include: { user: { select: { fullName: true } } },
                },
              },
            },
          },
          orderBy: { enrolledAt: "desc" },
        },
        parentLinksAsStudent: {
          where: { status: "CONFIRMED" },
          include: {
            parent: {
              include: {
                user: {
                  select: { id: true, fullName: true, phone: true, email: true },
                },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });
  }

  if (!student) {
    redirect("/center/students");
  }

  // Security role checks:
  if (currentRole === "STUDENT") {
    if (tenantCtx.membership?.id !== student.id && !tenantCtx.isPlatformStaff) {
      redirect("/center");
    }
  } else if (currentRole === "PARENT") {
    const parentLink = await tenantDb.parentLink.findFirst({
      where: {
        parentMembershipId: tenantCtx.membership?.id,
        studentMembershipId: student.id,
        status: "CONFIRMED",
      },
    });
    if (!parentLink && !tenantCtx.isPlatformStaff) {
      redirect("/center");
    }
  } else if (currentRole === "TEACHER") {
    const teacherEnrolled = await tenantDb.enrollment.findFirst({
      where: {
        studentMembershipId: student.id,
        group: { teacherMembershipId: tenantCtx.membership?.id },
      },
    });
    if (!teacherEnrolled && !tenantCtx.isPlatformStaff) {
      redirect("/center");
    }
  } else if (
    currentRole !== "DIRECTOR" &&
    currentRole !== "CENTER_ADMIN" &&
    !tenantCtx.isPlatformStaff
  ) {
    redirect("/center");
  }

  // Load attendances
  const attendances = await tenantDb.attendance.findMany({
    where: { studentMembershipId: student.id },
    orderBy: { markedAt: "desc" },
    take: 30,
    include: {
      lesson: { select: { title: true, scheduledAt: true } },
    },
  });

  // Load grades
  const grades = await tenantDb.grade.findMany({
    where: { studentMembershipId: student.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      lesson: { select: { title: true } },
      teacher: { include: { user: { select: { fullName: true } } } },
    },
  });

  // Load audit logs
  const auditLogs = await tenantDb.auditLog.findMany({
    where: {
      centerId: tenantCtx.center.id,
      resource: "Student",
      resourceId: student.id,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      action: true,
      createdAt: true,
      detailsJson: true,
    },
  });

  // Load active parent invite code if any
  const parentInvite = tenantDb.inviteCode
    ? await tenantDb.inviteCode.findFirst({
        where: {
          centerId: tenantCtx.center.id,
          studentMembershipId: student.id,
          targetRole: "PARENT",
          isRevoked: false,
        },
        orderBy: { createdAt: "desc" },
        select: {
          code: true,
          expiresAt: true,
          usesCount: true,
        },
      })
    : null;

  // Manageability / shared rule
  const targetUserId = student.user?.id || (student as { userId?: string }).userId;
  const manageability = targetUserId
    ? await canManageUserAccount(tenantCtx.center.id, targetUserId)
    : { canManage: true, isShared: false, reason: null };

  // Active sessions
  const activeSessions =
    targetUserId && db.userSession
      ? await db.userSession.findMany({
          where: {
            userId: targetUserId,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            ipAddress: true,
            userAgent: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      : [];

  const isSyntheticEmail = student.user.email.endsWith("@noemail.local");
  const hidePaymentsFromTeacher =
    (currentRole === "TEACHER" || currentRole === "TEACHER_ASSISTANT") &&
    !tenantCtx.isPlatformStaff;

  let performanceData: StudentPerformanceDTO | null = null;
  try {
    performanceData = await getStudentPerformanceData({
      centerId: tenantCtx.center.id,
      studentMembershipId: student.id,
      viewerRole: currentRole || "DIRECTOR",
      viewerMembershipId: tenantCtx.membership?.id ?? null,
      isPlatformStaff: tenantCtx.isPlatformStaff,
      period: "30d",
    });
  } catch {
    performanceData = null;
  }

  return (
    <StudentProfileClient
      student={student}
      membership={{
        id: student.id,
        role: student.role,
        status: student.status,
        joinedAt:
          typeof student.joinedAt === "string"
            ? student.joinedAt
            : student.joinedAt?.toISOString?.() || new Date().toISOString(),
      }}
      user={{
        id: student.user.id,
        fullName: student.user.fullName,
        email: isSyntheticEmail ? null : student.user.email,
        phone: student.user.phone,
        username: student.user.username,
        preferredLanguage: student.user.preferredLanguage,
        lastLoginAt: student.user.lastLoginAt ? student.user.lastLoginAt.toISOString() : null,
      }}
      enrollments={student.enrollments.map((e) => ({
        id: e.id,
        status: e.status,
        paidUntil: e.paidUntil ? e.paidUntil.toISOString() : null,
        frozenAt: e.frozenAt ? e.frozenAt.toISOString() : null,
        frozenUntil: e.frozenUntil ? e.frozenUntil.toISOString() : null,
        groupName: e.group.name,
        courseTitle: e.group.course?.title || "Курс",
        teacherName: e.group.teacher?.user?.fullName
          ? `Учитель: ${e.group.teacher.user.fullName}`
          : t(locale, "students.noTeacherAssigned") || "Преподаватель не назначен",
      }))}
      parents={student.parentLinksAsStudent.map((p) => ({
        linkId: p.id,
        parentId: p.parent.id,
        fullName: p.parent.user.fullName,
        phone: p.parent.user.phone,
        email: p.parent.user.email.endsWith("@noemail.local") ? null : p.parent.user.email,
        relationship: p.relationship,
        status: p.status,
      }))}
      parentInviteCode={
        parentInvite
          ? {
              code: parentInvite.code,
              expiresAt: parentInvite.expiresAt ? parentInvite.expiresAt.toISOString() : null,
              usesCount: parentInvite.usesCount,
            }
          : null
      }
      attendances={attendances.map((a) => ({
        id: a.id,
        status: a.status,
        markedAt: a.markedAt.toISOString(),
        lessonTitle: a.lesson.title,
      }))}
      grades={grades.map((g) => ({
        id: g.id,
        value: g.value,
        maxValue: g.maxValue,
        scoreText: `${g.value} / ${g.maxValue}`,
        weight: 1,
        lessonTitle: g.lesson?.title || t(locale, "students.lessonFallback"),
        teacherName: g.teacher?.user?.fullName || "Преподаватель",
        createdAt: g.createdAt.toISOString(),
      }))}
      payments={(hidePaymentsFromTeacher ? [] : student.payments).map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        method: p.paymentMethod,
        createdAt: p.createdAt.toISOString(),
      }))}
      activeSessions={activeSessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
      }))}
      auditLogs={auditLogs.map((a) => {
        let details: Record<string, unknown> | null = null;
        if (a.detailsJson) {
          try {
            details = JSON.parse(a.detailsJson);
          } catch {
            details = null;
          }
        }
        if (details && typeof details === "object") {
          const d = details as Record<string, unknown>;
          if (d.fromGroupName && d.toGroupName) {
            d.transferFormatted = t(locale, "students.transferHistory", {
              from: String(d.fromGroupName),
              to: String(d.toGroupName),
            });
          }
          if (d.reason) {
            d.reasonFormatted = t(locale, "students.reasonLabel", {
              reason: String(d.reason),
            });
          }
        }
        return {
          id: a.id,
          action: a.action,
          createdAt: a.createdAt.toISOString(),
          actorRole: null,
          details,
        };
      })}
      manageability={{
        canManage: manageability.canManage,
        isShared: manageability.isShared,
        reason: manageability.reason || undefined,
      }}
      statusLabel={t(locale, student.status === "ACTIVE" ? "students.statusActive" : "students.statusArchived")}
      backLabel={t(locale, "common.back") || "Назад"}
      noGroups={student.enrollments.length === 0 ? t(locale, "students.noGroups") : ""}
      noParents={student.parentLinksAsStudent.length === 0 ? t(locale, "students.noParents") : ""}
      noPayments={hidePaymentsFromTeacher || student.payments.length === 0 ? t(locale, "students.noPayments") : ""}
      noHistory={auditLogs.length === 0 ? t(locale, "students.noHistory") : ""}
      confirmedLabel={t(locale, "common.yes")}
      actorRole={currentRole}
      locale={locale}
      performanceData={performanceData}
    />
  );
}
