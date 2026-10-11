import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { Prisma } from "@prisma/client";

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const BYDAY_MAP = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const teacherMembershipId = searchParams.get("teacherMembershipId");

    const whereCondition: Prisma.ScheduleSlotWhereInput = {
      status: { in: ["ACTIVE", "CANCELLED"] },
    };

    if (groupId) {
      whereCondition.groupId = groupId;
    }

    if (teacherMembershipId) {
      whereCondition.teacherMembershipId = teacherMembershipId;
    }

    // Role-based scoping
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      whereCondition.teacherMembershipId = tenantCtx.membership.id;
    } else if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      const enrollments = await tenantDb.enrollment.findMany({
        where: { studentMembershipId: tenantCtx.membership.id, status: "ACTIVE" },
        select: { groupId: true },
      });
      whereCondition.groupId = { in: enrollments.map((e) => e.groupId) };
    } else if (tenantCtx.role === "PARENT" && tenantCtx.membership) {
      const childLinks = await tenantDb.parentLink.findMany({
        where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
        select: { studentMembershipId: true },
      });
      const childEnrollments = await tenantDb.enrollment.findMany({
        where: {
          studentMembershipId: { in: childLinks.map((l) => l.studentMembershipId) },
          status: "ACTIVE",
        },
        select: { groupId: true },
      });
      whereCondition.groupId = { in: childEnrollments.map((e) => e.groupId) };
    }

    const slots = await tenantDb.scheduleSlot.findMany({
      where: whereCondition,
      include: {
        group: { include: { course: { select: { title: true } }, subject: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
        branch: { select: { name: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    const now = new Date();
    const dtstamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    // Build RFC 5545 content
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Aziz LMS Platform//Schedule Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeIcal(tenantCtx.center.name + " Schedule")}`,
      "X-WR-TIMEZONE:Asia/Tashkent",
    ];

    for (const slot of slots) {
      // Base date: Monday 2026-09-07 was Mon (dayOfWeek = 1)
      const dayOffset = (slot.dayOfWeek >= 1 && slot.dayOfWeek <= 7 ? slot.dayOfWeek : 1) - 1;
      const dayNum = (7 + dayOffset).toString().padStart(2, "0");
      const baseDateStr = `202609${dayNum}`;

      const startClean = slot.startTime.replace(":", "") + "00";
      const endClean = slot.endTime.replace(":", "") + "00";
      const dtStart = `${baseDateStr}T${startClean}`;
      const dtEnd = `${baseDateStr}T${endClean}`;

      const byDay = BYDAY_MAP[slot.dayOfWeek] || "MO";
      const summary = `${slot.group.name}${slot.group.course?.title ? " - " + slot.group.course.title : ""}`;
      const teacherName = slot.teacher?.user?.fullName || "Unassigned";
      const descParts = [`Teacher: ${teacherName}`];
      if (slot.roomName) descParts.push(`Room: ${slot.roomName}`);
      if (slot.cancelledReason) descParts.push(`Cancelled reason: ${slot.cancelledReason}`);
      const description = descParts.join("\\n");
      const location = slot.roomName || slot.branch?.name || "";

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:slot-${slot.id}@aziz-lms`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
      if (slot.isRecurring) {
        lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`);
      }
      lines.push(`SUMMARY:${escapeIcal(summary)}`);
      lines.push(`DESCRIPTION:${description}`);
      if (location) {
        lines.push(`LOCATION:${escapeIcal(location)}`);
      }
      lines.push(`STATUS:${slot.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const icalContent = lines.join("\r\n") + "\r\n";

    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="schedule.ics"',
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 401 });
  }
}
