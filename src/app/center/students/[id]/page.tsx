import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
// Reason: Exception: Server page checks session models and shared rules.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { canManageUserAccount } from "@/lib/tenant-user-guard";
import { StudentProfileClient } from "@/components/students/StudentProfileClient";

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
  const student = await tenantDb.centerMembership.findFirst({
    where: {
      centerId: tenantCtx.center.id,
      role: "STUDENT",
      OR: [
        { id: studentMembershipId },
        { userId: studentMembershipId },
      ],
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
      OR: [
        { resourceId: student.id },
        { resourceId: student.user.id },
        { actorUserId: student.user.id },
      ],
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
  const parentInvite = await tenantDb.inviteCode.findFirst({
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
  });

  // Manageability / shared rule
  const manageability = await canManageUserAccount(tenantCtx.center.id, student.user.id);

  // Active sessions
  const activeSessions = await db.userSession.findMany({
    where: {
      userId: student.user.id,
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
  });

  const isSyntheticEmail = student.user.email.endsWith("@noemail.local");

  return (
    <StudentProfileClient
      membership={{
        id: student.id,
        role: student.role,
        status: student.status,
        joinedAt: student.joinedAt.toISOString(),
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
        groupName: e.group.name,
        courseTitle: e.group.course?.title || "Курс",
        teacherName: e.group.teacher?.user?.fullName || "Преподаватель",
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
        weight: 1,
        lessonTitle: g.lesson?.title || "Урок",
        teacherName: g.teacher?.user?.fullName || "Преподаватель",
        createdAt: g.createdAt.toISOString(),
      }))}
      payments={student.payments.map((p) => ({
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
      auditLogs={auditLogs.map((a) => ({
        id: a.id,
        action: a.action,
        createdAt: a.createdAt.toISOString(),
        actorRole: null,
        details: a.detailsJson ? JSON.parse(a.detailsJson) : null,
      }))}
      manageability={{
        canManage: manageability.canManage,
        isShared: manageability.isShared,
        reason: manageability.reason,
      }}
      actorRole={currentRole}
      locale={locale}
    />
  );
}
