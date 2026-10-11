import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

interface GradeItem {
  id: string;
  gradeType: string;
  value: number;
  maxValue: number;
  lifecycle: string;
  comment: string | null;
  lessonId: string | null;
  createdAt: Date;
}

interface StudentMatrixRow {
  studentMembershipId: string;
  studentName: string;
  studentEmail: string;
  grades: GradeItem[];
  weightedScore: number;
  letterGrade: string;
}

const TYPE_WEIGHTS: Record<string, number> = {
  HOMEWORK: 0.15,
  WRITTEN: 0.15,
  ORAL: 0.15,
  TEST: 0.20,
  MIDTERM: 0.20,
  FINAL: 0.30,
  PROJECT: 0.20,
  OTHER: 0.10,
};

function calculateLetterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function computeWeightedScore(grades: GradeItem[]): number {
  if (grades.length === 0) return 0;

  // Group grades by type
  const typeTotals: Record<string, { totalPercent: number; count: number }> = {};

  for (const g of grades) {
    if (g.maxValue <= 0) continue;
    const pct = (g.value / g.maxValue) * 100;
    if (!typeTotals[g.gradeType]) {
      typeTotals[g.gradeType] = { totalPercent: 0, count: 0 };
    }
    typeTotals[g.gradeType].totalPercent += pct;
    typeTotals[g.gradeType].count += 1;
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const [type, data] of Object.entries(typeTotals)) {
    const avg = data.totalPercent / data.count;
    const weight = TYPE_WEIGHTS[type] ?? 0.10;
    weightedSum += avg * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");

    if (!groupId) {
      return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    }

    const group = await tenantDb.group.findFirst({
      where: { id: groupId },
    });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Role checks
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      if (group.teacherMembershipId !== tenantCtx.membership.id) {
        return NextResponse.json(
          { error: "Forbidden: You do not teach this group" },
          { status: 403 }
        );
      }
    }

    // Fetch enrollments
    const enrollments = await tenantDb.enrollment.findMany({
      where: { groupId, status: "ACTIVE" },
      include: {
        student: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { student: { user: { fullName: "asc" } } },
    });

    // Fetch grades for group
    const grades = await tenantDb.grade.findMany({
      where: { groupId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });

    // Group grades by studentMembershipId
    const gradesByStudent = new Map<string, GradeItem[]>();
    for (const g of grades) {
      const list = gradesByStudent.get(g.studentMembershipId) || [];
      list.push({
        id: g.id,
        gradeType: g.gradeType,
        value: g.value,
        maxValue: g.maxValue,
        lifecycle: g.lifecycle,
        comment: g.comment,
        lessonId: g.lessonId,
        createdAt: g.createdAt,
      });
      gradesByStudent.set(g.studentMembershipId, list);
    }

    // Role scoping for students/parents
    let visibleEnrollments = enrollments;
    if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      visibleEnrollments = enrollments.filter(
        (e) => e.studentMembershipId === tenantCtx.membership!.id
      );
    } else if (tenantCtx.role === "PARENT" && tenantCtx.membership) {
      const childLinks = await tenantDb.parentLink.findMany({
        where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
        select: { studentMembershipId: true },
      });
      const childIds = new Set(childLinks.map((l) => l.studentMembershipId));
      visibleEnrollments = enrollments.filter((e) => childIds.has(e.studentMembershipId));
    }

    const students: StudentMatrixRow[] = visibleEnrollments.map((e) => {
      const studentGrades = gradesByStudent.get(e.studentMembershipId) || [];
      const score = computeWeightedScore(studentGrades);
      const letter = calculateLetterGrade(score);
      return {
        studentMembershipId: e.studentMembershipId,
        studentName: e.student.user.fullName || e.student.user.email,
        studentEmail: e.student.user.email,
        grades: studentGrades,
        weightedScore: score,
        letterGrade: letter,
      };
    });

    return NextResponse.json({
      groupId: group.id,
      groupName: group.name,
      students,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error?.message || "Server error", code: error?.code },
      { status: error?.status || 400 }
    );
  }
}
