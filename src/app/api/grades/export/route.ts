import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { generateCsv } from "@/lib/csv";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      tenantCtx.role !== "TEACHER" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json(
        { error: "Forbidden: Cannot export grades" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");

    if (groupId) {
      const group = await tenantDb.group.findFirst({
        where: { id: groupId },
      });
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
      if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
        if (group.teacherMembershipId !== tenantCtx.membership.id) {
          return NextResponse.json(
            { error: "Forbidden: You do not teach this group" },
            { status: 403 }
          );
        }
      }
    } else if (tenantCtx.role === "TEACHER") {
      return NextResponse.json(
        { error: "groupId is required for teachers" },
        { status: 400 }
      );
    }

    const grades = await tenantDb.grade.findMany({
      where: {
        deletedAt: null,
        ...(groupId ? { groupId } : {}),
      },
      include: {
        student: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
        group: {
          select: { name: true },
        },
        lesson: {
          select: { title: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "Student Name",
      "Student Email",
      "Group",
      "Lesson",
      "Type",
      "Score",
      "Max Score",
      "Lifecycle",
      "Comment",
      "Date",
    ];

    const rows = grades.map((g) => [
      g.student.user.fullName || "",
      g.student.user.email,
      g.group?.name || "",
      g.lesson?.title || "",
      g.gradeType,
      g.value,
      g.maxValue,
      g.lifecycle,
      g.comment || "",
      g.createdAt.toISOString(),
    ]);

    const csv = generateCsv(headers, rows);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="grades-${groupId || "all"}.csv"`,
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error?.message || "Server error", code: error?.code },
      { status: error?.status || 400 }
    );
  }
}
