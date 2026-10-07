import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { sendNotification } from "@/lib/notifications";

// ─── Conflict Detection Helper ───────────────────────────────────────────────

interface ConflictCheckParams {
  tenantDb: any;
  groupId: string;
  teacherMembershipId: string;
  branchId?: string | null;
  roomName?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  excludeSlotId?: string; // for updates
}

async function detectConflicts(params: ConflictCheckParams) {
  const conflicts: string[] = [];

  // Build base query for same day/time overlap
  const timeConflictWhere = {
    dayOfWeek: params.dayOfWeek,
    status: "ACTIVE",
    id: params.excludeSlotId ? { not: params.excludeSlotId } : undefined,
    // Simple string comparison for time overlap (works for HH:MM format)
    AND: [
      { startTime: { lt: params.endTime } },
      { endTime: { gt: params.startTime } },
    ],
  };

  // 1. Check teacher conflict — same teacher at the same time
  const teacherConflict = await params.tenantDb.scheduleSlot.findFirst({
    where: {
      ...timeConflictWhere,
      teacherMembershipId: params.teacherMembershipId,
    },
    include: { group: { select: { name: true } } },
  });
  if (teacherConflict) {
    conflicts.push(`Teacher already has a class at this time (Group: ${teacherConflict.group.name})`);
  }

  // 2. Check group conflict — same group at the same time
  const groupConflict = await params.tenantDb.scheduleSlot.findFirst({
    where: {
      ...timeConflictWhere,
      groupId: params.groupId,
    },
  });
  if (groupConflict) {
    conflicts.push(`Group already has a class scheduled at this time`);
  }

  // 3. Check room conflict — same room/branch at the same time
  if (params.roomName && params.branchId) {
    const roomConflict = await params.tenantDb.scheduleSlot.findFirst({
      where: {
        ...timeConflictWhere,
        branchId: params.branchId,
        roomName: params.roomName,
      },
      include: { group: { select: { name: true } } },
    });
    if (roomConflict) {
      conflicts.push(`Room "${params.roomName}" is already occupied at this time (Group: ${roomConflict.group.name})`);
    }
  }

  return conflicts;
}

// ─── GET /api/tenant/schedule ─────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const branchId = searchParams.get("branchId");
    const dayOfWeek = searchParams.get("dayOfWeek");

    let whereCondition: any = { status: "ACTIVE" };

    if (groupId) {
      const group = await tenantDb.group.findFirst({
        where: { id: groupId },
      });
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      whereCondition.groupId = groupId;
    }

    if (branchId) {
      whereCondition.branchId = branchId;
    }

    if (dayOfWeek) {
      whereCondition.dayOfWeek = parseInt(dayOfWeek);
    }

    // TEACHER role: only see schedule for their groups
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      whereCondition.teacherMembershipId = tenantCtx.membership.id;
    }

    // STUDENT role: only see schedule for their enrolled groups
    if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      const enrollments = await tenantDb.enrollment.findMany({
        where: { studentMembershipId: tenantCtx.membership.id },
        select: { groupId: true },
      });
      whereCondition.groupId = { in: enrollments.map((e) => e.groupId) };
    }

    // PARENT role: see schedule for children's groups
    if (tenantCtx.role === "PARENT" && tenantCtx.membership) {
      const childLinks = await tenantDb.parentLink.findMany({
        where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
        select: { studentMembershipId: true },
      });
      const childEnrollments = await tenantDb.enrollment.findMany({
        where: { studentMembershipId: { in: childLinks.map((l) => l.studentMembershipId) } },
        select: { groupId: true },
      });
      whereCondition.groupId = { in: childEnrollments.map((e) => e.groupId) };
    }

    const slots = await tenantDb.scheduleSlot.findMany({
      where: whereCondition,
      include: {
        group: { include: { course: { select: { title: true } }, subject: true } },
        teacher: { include: { user: { select: { fullName: true } } } },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ slots });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// ─── POST /api/tenant/schedule ────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden: Only admins can manage schedule" }, { status: 403 });
    }

    const { groupId, teacherMembershipId, branchId, roomName, dayOfWeek, startTime, endTime, subjectId } =
      await req.json();

    if (!groupId || !teacherMembershipId || !dayOfWeek || !startTime || !endTime) {
      return NextResponse.json({ error: "groupId, teacherMembershipId, dayOfWeek, startTime, endTime are required" }, { status: 400 });
    }

    if (dayOfWeek < 1 || dayOfWeek > 7) {
      return NextResponse.json({ error: "dayOfWeek must be 1-7 (Mon-Sun)" }, { status: 400 });
    }

    const group = await tenantDb.group.findFirst({
      where: { id: groupId },
    });
    if (!group) return NextResponse.json({ error: "Group not found in this center" }, { status: 404 });

    const teacher = await tenantDb.centerMembership.findFirst({
      where: { id: teacherMembershipId },
    });
    if (!teacher) return NextResponse.json({ error: "Teacher not found in this center" }, { status: 404 });

    // Conflict detection
    const conflicts = await detectConflicts({
      tenantDb,
      groupId,
      teacherMembershipId,
      branchId,
      roomName,
      dayOfWeek,
      startTime,
      endTime,
    });

    if (conflicts.length > 0) {
      return NextResponse.json({ error: "Schedule conflicts detected", conflicts }, { status: 409 });
    }

    const slot = await tenantDb.scheduleSlot.create({
      data: {
        centerId: tenantCtx.center.id,
        groupId,
        teacherMembershipId,
        branchId: branchId || null,
        subjectId: subjectId || null,
        roomName: roomName?.trim() || null,
        dayOfWeek,
        startTime,
        endTime,
        createdByMemberId: tenantCtx.membership?.id,
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "SCHEDULE_CREATED",
      resource: "ScheduleSlot",
      resourceId: slot.id,
      details: { groupId, dayOfWeek, startTime, endTime },
    });

    return NextResponse.json({ success: true, slot });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// ─── PATCH /api/tenant/schedule ───────────────────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, groupId, teacherMembershipId, branchId, roomName, dayOfWeek, startTime, endTime, status, cancelledReason } =
      await req.json();

    if (!id) return NextResponse.json({ error: "Slot ID required" }, { status: 400 });

    const existing = await tenantDb.scheduleSlot.findFirst({
      where: { id },
    });
    if (!existing) return NextResponse.json({ error: "Schedule slot not found" }, { status: 404 });

    const updatedGroupId = groupId || existing.groupId;
    const updatedTeacherId = teacherMembershipId || existing.teacherMembershipId;
    const updatedDay = dayOfWeek || existing.dayOfWeek;
    const updatedStart = startTime || existing.startTime;
    const updatedEnd = endTime || existing.endTime;

    if (groupId && groupId !== existing.groupId) {
      const group = await tenantDb.group.findFirst({
        where: { id: groupId },
      });
      if (!group) return NextResponse.json({ error: "Group not found in this center" }, { status: 404 });
    }

    if (teacherMembershipId && teacherMembershipId !== existing.teacherMembershipId) {
      const teacher = await tenantDb.centerMembership.findFirst({
        where: { id: teacherMembershipId },
      });
      if (!teacher) return NextResponse.json({ error: "Teacher not found in this center" }, { status: 404 });
    }

    if (branchId && branchId !== existing.branchId) {
      const branch = await tenantDb.branch.findFirst({
        where: { id: branchId },
      });
      if (!branch) return NextResponse.json({ error: "Branch not found in this center" }, { status: 404 });
    }

    if (groupId || teacherMembershipId || dayOfWeek || startTime || endTime) {
      const conflicts = await detectConflicts({
        tenantDb,
        groupId: updatedGroupId,
        teacherMembershipId: updatedTeacherId,
        branchId: branchId ?? existing.branchId,
        roomName: roomName ?? existing.roomName,
        dayOfWeek: updatedDay,
        startTime: updatedStart,
        endTime: updatedEnd,
        excludeSlotId: id,
      });

      if (conflicts.length > 0) {
        return NextResponse.json({ error: "Schedule conflicts detected", conflicts }, { status: 409 });
      }
    }

    await tenantDb.scheduleSlot.updateMany({
      where: { id },
      data: {
        groupId: updatedGroupId,
        teacherMembershipId: updatedTeacherId,
        branchId: branchId !== undefined ? branchId || null : existing.branchId,
        roomName: roomName !== undefined ? roomName?.trim() || null : existing.roomName,
        dayOfWeek: updatedDay,
        startTime: updatedStart,
        endTime: updatedEnd,
        status: status || existing.status,
        cancelledReason: cancelledReason || existing.cancelledReason,
      },
    });
    const slot = await tenantDb.scheduleSlot.findFirst({ where: { id } });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "SCHEDULE_UPDATED",
      resource: "ScheduleSlot",
      resourceId: id,
      details: { status, dayOfWeek },
    });

    if (status === "CANCELLED" || existing.dayOfWeek !== updatedDay || existing.startTime !== updatedStart) {
      const groupEnrollments = await tenantDb.enrollment.findMany({
        where: { groupId: updatedGroupId, status: "ACTIVE" },
        include: { student: true },
      });
      const group = await tenantDb.group.findFirst({ where: { id: updatedGroupId }, select: { name: true } });
      
      const notifType = status === "CANCELLED" ? "SCHEDULE_CANCELLED" : "SCHEDULE_CHANGE";
      const titleKey = status === "CANCELLED" ? "notifications.scheduleCancelled" : "notifications.scheduleChanged";
      
      for (const en of groupEnrollments) {
        if (en.student.userId) {
          await sendNotification({
            userId: en.student.userId,
            centerId: tenantCtx.center.id,
            type: notifType,
            titleKey,
            bodyKey: "notifications.scheduleBody",
            bodyParams: { groupName: group?.name || "" },
          });
        }
      }
    }

    return NextResponse.json({ success: true, slot });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// ─── DELETE /api/tenant/schedule ──────────────────────────────────────────────

export async function DELETE(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Slot ID required" }, { status: 400 });

    const existing = await tenantDb.scheduleSlot.findFirst({
      where: { id },
    });
    if (!existing) return NextResponse.json({ error: "Schedule slot not found" }, { status: 404 });

    await tenantDb.scheduleSlot.deleteMany({ where: { id } });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "SCHEDULE_DELETED",
      resource: "ScheduleSlot",
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}
