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
        { error: "Forbidden: Cannot export attendance" },
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

    const records = await tenantDb.attendance.findMany({
      where: groupId ? { groupId } : {},
      include: {
        student: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
        lesson: {
          select: { title: true, scheduledAt: true },
        },
      },
      orderBy: { markedAt: "desc" },
    });

    const headers = ["Student Name", "Student Email", "Lesson", "Date", "Status", "Note"];
    const rows = records.map((r) => [
      r.student.user.fullName || "",
      r.student.user.email,
      r.lesson.title,
      r.lesson.scheduledAt ? new Date(r.lesson.scheduledAt).toISOString() : "",
      r.status,
      r.note || "",
    ]);

    const csv = generateCsv(headers, rows);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance-${groupId || "all"}.csv"`,
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
