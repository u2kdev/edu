import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const thresholdParam = searchParams.get("threshold");
    const threshold = thresholdParam ? parseInt(thresholdParam, 10) : 80;

    // Base where condition for attendance
    const whereCondition: Prisma.AttendanceWhereInput = {
      lesson: { module: { course: { centerId: tenantCtx.center.id } } },
    };

    if (groupId) {
      whereCondition.student = {
        enrollments: {
          some: { groupId, status: "ACTIVE" },
        },
      };
    }

    // Role-based scoping
    if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      whereCondition.studentMembershipId = tenantCtx.membership.id;
    } else if (tenantCtx.role === "PARENT" && tenantCtx.membership) {
      const childLinks = await tenantDb.parentLink.findMany({
        where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
        select: { studentMembershipId: true },
      });
      whereCondition.studentMembershipId = {
        in: childLinks.map((l) => l.studentMembershipId),
      };
    } else if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      const teacherGroups = await tenantDb.group.findMany({
        where: { teacherMembershipId: tenantCtx.membership.id },
        select: { id: true },
      });
      whereCondition.student = {
        enrollments: {
          some: {
            groupId: { in: teacherGroups.map((g) => g.id) },
            status: "ACTIVE",
          },
        },
      };
    }

    const attendances = await tenantDb.attendance.findMany({
      where: whereCondition,
      include: {
        student: {
          include: {
            user: { select: { fullName: true, email: true } },
            enrollments: {
              where: { status: "ACTIVE" },
              include: { group: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    // Aggregate by student
    interface StudentAgg {
      studentMembershipId: string;
      fullName: string;
      email: string;
      groups: string[];
      total: number;
      present: number;
      late: number;
      absent: number;
      excused: number;
    }

    const studentMap = new Map<string, StudentAgg>();

    for (const att of attendances) {
      const sId = att.studentMembershipId;
      if (!studentMap.has(sId)) {
        studentMap.set(sId, {
          studentMembershipId: sId,
          fullName: att.student.user.fullName,
          email: att.student.user.email,
          groups: att.student.enrollments.map((e) => e.group.name),
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
        });
      }

      const agg = studentMap.get(sId)!;
      agg.total += 1;
      if (att.status === "PRESENT") agg.present += 1;
      else if (att.status === "LATE") agg.late += 1;
      else if (att.status === "ABSENT") agg.absent += 1;
      else if (att.status === "EXCUSED") agg.excused += 1;
    }

    const calculatedStudents = Array.from(studentMap.values()).map((s) => {
      const attended = s.present + s.late;
      const rate = s.total > 0 ? Math.round((attended / s.total) * 100) : 100;
      const isAtRisk = rate < threshold && (s.total >= 2 || s.absent >= 2);

      return {
        studentMembershipId: s.studentMembershipId,
        fullName: s.fullName,
        email: s.email,
        groups: s.groups,
        totalLessons: s.total,
        presentCount: s.present,
        lateCount: s.late,
        absentCount: s.absent,
        excusedCount: s.excused,
        attendanceRate: rate,
        isAtRisk,
      };
    });

    // If student role, return only their personal stats
    if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      const personal = calculatedStudents[0] || {
        studentMembershipId: tenantCtx.membership.id,
        fullName: tenantCtx.session.user.fullName,
        email: tenantCtx.session.user.email,
        groups: [],
        totalLessons: 0,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
        excusedCount: 0,
        attendanceRate: 100,
        isAtRisk: false,
      };

      return NextResponse.json({
        studentStats: personal,
        riskList: [],
      });
    }

    // Risk list: students with isAtRisk === true, sorted by lowest rate
    const riskList = calculatedStudents
      .filter((s) => s.isAtRisk)
      .sort((a, b) => a.attendanceRate - b.attendanceRate);

    const totalStudents = calculatedStudents.length;
    const avgRate =
      totalStudents > 0
        ? Math.round(
            calculatedStudents.reduce((acc, curr) => acc + curr.attendanceRate, 0) /
              totalStudents
          )
        : 100;

    return NextResponse.json({
      summary: {
        averageAttendanceRate: avgRate,
        totalStudents,
        atRiskCount: riskList.length,
      },
      riskList,
      allStats: calculatedStudents,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: error.status || 500 }
    );
  }
}
