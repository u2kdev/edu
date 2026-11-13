import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const actorRole = tenantCtx.membership?.role;

    const canView = hasPermission(
      "students.read",
      tenantCtx.session.user.platformRole,
      actorRole
    );
    if (!canView && tenantCtx.membership?.id !== params.id) {
      return NextResponse.json(
        { error: "Недостаточно прав для просмотра табеля" },
        { status: 403 }
      );
    }

    const { id } = params;

    // Student membership
    const student = await tenantDb.centerMembership.findFirst({
      where: { id, role: "STUDENT" },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            group: {
              include: {
                course: { select: { id: true, title: true } },
                teacher: {
                  include: {
                    user: { select: { fullName: true } },
                  },
                },
              },
            },
          },
        },
        attendances: {
          include: {
            lesson: {
              select: { id: true, title: true, scheduledAt: true },
            },
          },
          orderBy: { markedAt: "desc" },
        },
        gradesAsStudent: {
          include: {
            group: { select: { name: true } },
            lesson: { select: { title: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        testAttempts: {
          include: {
            test: {
              include: {
                material: { select: { title: true } },
              },
            },
          },
          orderBy: { startedAt: "desc" },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Студент не найден" }, { status: 404 });
    }

    // Attendance stats
    const totalAttendances = student.attendances.length;
    const presentCount = student.attendances.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const absentCount = student.attendances.filter(
      (a) => a.status === "ABSENT"
    ).length;
    const excusedCount = student.attendances.filter(
      (a) => a.status === "EXCUSED"
    ).length;
    const attendanceRate =
      totalAttendances > 0
        ? Math.round((presentCount / totalAttendances) * 100)
        : 100;

    // Grades stats
    const totalGrades = student.gradesAsStudent.length;
    const avgGrade =
      totalGrades > 0
        ? Math.round(
            (student.gradesAsStudent.reduce((sum, g) => sum + g.value, 0) /
              totalGrades) *
              10
          ) / 10
        : 0;

    // Test stats
    const completedAttempts = student.testAttempts.filter(
      (a) => a.completedAt !== null
    );
    const avgTestScore =
      completedAttempts.length > 0
        ? Math.round(
            completedAttempts.reduce((sum, a) => sum + (a.scorePercent ?? 0), 0) /
              completedAttempts.length
          )
        : 0;

    const transcriptData = {
      student: {
        id: student.id,
        name: student.user.fullName,
        email: student.user.email,
        phone: student.user.phone,
        joinedAt: student.joinedAt,
      },
      center: {
        id: tenantCtx.center.id,
        name: tenantCtx.center.name,
      },
      summary: {
        attendanceRate,
        totalClasses: totalAttendances,
        presentCount,
        absentCount,
        excusedCount,
        averageGrade: avgGrade,
        totalGrades,
        completedTestsCount: completedAttempts.length,
        averageTestScore: avgTestScore,
      },
      groups: student.enrollments.map((e) => ({
        groupId: e.group.id,
        groupName: e.group.name,
        courseTitle: e.group.course?.title || "Без курса",
        teacherName: e.group.teacher?.user?.fullName || "Не назначен",
      })),
      grades: student.gradesAsStudent.map((g) => ({
        id: g.id,
        type: g.gradeType,
        value: g.value,
        maxValue: g.maxValue,
        comment: g.comment,
        groupName: g.group?.name || null,
        lessonTitle: g.lesson?.title || null,
        date: g.createdAt,
      })),
      testAttempts: completedAttempts.map((a) => ({
        id: a.id,
        testTitle: a.test.material.title,
        scorePercent: a.scorePercent,
        scorePoints: a.scorePoints,
        maxPoints: a.maxPoints,
        passingScore: a.test.passingScorePercent,
        passed: (a.scorePercent ?? 0) >= a.test.passingScorePercent,
        completedAt: a.completedAt,
      })),
    };

    const url = new URL(req.url);
    if (url.searchParams.get("format") === "csv") {
      // Build CSV
      const rows: string[] = [];
      rows.push(`"ТАБЕЛЬ УСПЕВАЕМОСТИ: ${student.user.fullName}"`);
      rows.push(`"Учебный центр:","${tenantCtx.center.name}"`);
      rows.push(`"Дата формирования:","${new Date().toLocaleDateString("ru-RU")}"`);
      rows.push(`"Посещаемость:","${attendanceRate}% (${presentCount} из ${totalAttendances} занятий)"`);
      rows.push(`"Средний балл:","${avgGrade}"`);
      rows.push(`"Средний балл за тесты:","${avgTestScore}%"`);
      rows.push("");
      rows.push(`"ОЦЕНКИ"`);
      rows.push(`"Дата","Предмет/Группа","Тип","Оценка","Макс","Комментарий"`);
      student.gradesAsStudent.forEach((g) => {
        const dateStr = new Date(g.createdAt).toLocaleDateString("ru-RU");
        const groupStr = g.group?.name || "-";
        const comm = (g.comment || "").replace(/"/g, '""');
        rows.push(`"${dateStr}","${groupStr}","${g.gradeType}","${g.value}","${g.maxValue}","${comm}"`);
      });
      rows.push("");
      rows.push(`"ТЕСТЫ"`);
      rows.push(`"Дата","Тест","Результат (%)","Баллы","Статус"`);
      completedAttempts.forEach((a) => {
        const dateStr = a.completedAt
          ? new Date(a.completedAt).toLocaleDateString("ru-RU")
          : "-";
        const title = a.test.material.title.replace(/"/g, '""');
        const status = (a.scorePercent ?? 0) >= a.test.passingScorePercent ? "СДАН" : "НЕ СДАН";
        rows.push(`"${dateStr}","${title}","${a.scorePercent}%","${a.scorePoints}/${a.maxPoints}","${status}"`);
      });

      const csvContent = "\uFEFF" + rows.join("\r\n");
      const filename = `transcript_${student.user.fullName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;

      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    }

    return NextResponse.json(transcriptData);
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: error?.status || 500 }
    );
  }
}
