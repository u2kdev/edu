import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// GET /api/tenant/announcements
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") || "20"));
    const now = new Date();

    let whereCondition: any = {
      centerId: tenantCtx.center.id,
      publishAt: { lte: now }, // Only published
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }], // Not expired
    };

    // Role-based filtering: show announcements targeted to this role or all
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN") {
      whereCondition.AND = [
        {
          OR: [
            { targetRole: null }, // Announcements for everyone
            { targetRole: tenantCtx.role }, // Announcements for this role
          ],
        },
      ];

      // Student/Parent: also filter by enrolled groups
      if (
        (tenantCtx.role === "STUDENT" || tenantCtx.role === "PARENT") &&
        tenantCtx.membership
      ) {
        let relevantGroupIds: string[] = [];

        if (tenantCtx.role === "STUDENT") {
          const enrollments = await db.enrollment.findMany({
            where: { studentMembershipId: tenantCtx.membership.id },
            select: { groupId: true },
          });
          relevantGroupIds = enrollments.map((e) => e.groupId);
        } else {
          const childLinks = await db.parentLink.findMany({
            where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
            select: { studentMembershipId: true },
          });
          const childEnrollments = await db.enrollment.findMany({
            where: { studentMembershipId: { in: childLinks.map((l) => l.studentMembershipId) } },
            select: { groupId: true },
          });
          relevantGroupIds = childEnrollments.map((e) => e.groupId);
        }

        whereCondition.AND[0].OR.push({ groupId: { in: relevantGroupIds } });
      }
    }

    if (groupId) {
      // SECURITY: Validate group belongs to tenant
      const group = await db.group.findFirst({
        where: { id: groupId, course: { centerId: tenantCtx.center.id } },
      });
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      whereCondition.groupId = groupId;
    }

    const [announcements, total] = await db.$transaction([
      db.announcement.findMany({
        where: whereCondition,
        include: {
          author: { include: { user: { select: { fullName: true } } } },
          group: { select: { id: true, name: true } },
        },
        orderBy: [{ isPinned: "desc" }, { publishAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.announcement.count({ where: whereCondition }),
    ]);

    return NextResponse.json({ announcements, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// POST /api/tenant/announcements
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();

    // Teachers can create announcements for their own groups only
    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      tenantCtx.role !== "TEACHER" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden: Cannot create announcements" }, { status: 403 });
    }

    if (!tenantCtx.membership?.id) {
      return NextResponse.json({ error: "No membership found" }, { status: 403 });
    }

    const { title, body, targetRole, groupId, isPinned, publishAt, expiresAt } = await req.json();

    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
    }

    // TEACHER: can only target their own groups
    if (tenantCtx.role === "TEACHER" && groupId) {
      const group = await db.group.findFirst({
        where: {
          id: groupId,
          teacherMembershipId: tenantCtx.membership.id,
          course: { centerId: tenantCtx.center.id },
        },
      });
      if (!group) {
        return NextResponse.json({ error: "You can only post announcements to your own groups" }, { status: 403 });
      }
    }

    // Validate groupId belongs to this tenant
    if (groupId) {
      const group = await db.group.findFirst({
        where: { id: groupId, course: { centerId: tenantCtx.center.id } },
      });
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const announcement = await db.announcement.create({
      data: {
        centerId: tenantCtx.center.id,
        authorId: tenantCtx.membership.id,
        title: title.trim(),
        body: body.trim(),
        targetRole: targetRole || null,
        groupId: groupId || null,
        isPinned: isPinned ?? false,
        publishAt: publishAt ? new Date(publishAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "ANNOUNCEMENT_CREATED",
      resource: "Announcement",
      resourceId: announcement.id,
      details: { title, targetRole, groupId },
    });

    return NextResponse.json({ success: true, announcement });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// PATCH /api/tenant/announcements
export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const { id, title, body, targetRole, groupId, isPinned, publishAt, expiresAt } = await req.json();

    if (!id) return NextResponse.json({ error: "Announcement ID required" }, { status: 400 });

    // SECURITY: Verify announcement belongs to this tenant
    const existing = await db.announcement.findFirst({
      where: { id, centerId: tenantCtx.center.id },
    });
    if (!existing) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });

    // TEACHER: can only edit their own announcements
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      if (existing.authorId !== tenantCtx.membership.id) {
        return NextResponse.json({ error: "You can only edit your own announcements" }, { status: 403 });
      }
    } else if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (groupId && groupId !== existing.groupId) {
      const group = await db.group.findFirst({
        where: { id: groupId, course: { centerId: tenantCtx.center.id } },
      });
      if (!group) return NextResponse.json({ error: "Group not found in this center" }, { status: 404 });
    }

    const announcement = await db.announcement.update({
      where: { id },
      data: {
        title: title?.trim() || existing.title,
        body: body?.trim() || existing.body,
        targetRole: targetRole !== undefined ? targetRole : existing.targetRole,
        groupId: groupId !== undefined ? groupId : existing.groupId,
        isPinned: isPinned !== undefined ? isPinned : existing.isPinned,
        publishAt: publishAt ? new Date(publishAt) : existing.publishAt,
        expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : existing.expiresAt,
      },
    });

    return NextResponse.json({ success: true, announcement });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// DELETE /api/tenant/announcements
export async function DELETE(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Announcement ID required" }, { status: 400 });

    const existing = await db.announcement.findFirst({
      where: { id, centerId: tenantCtx.center.id },
    });
    if (!existing) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });

    // Only the author, admin, or director can delete
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership && existing.authorId !== tenantCtx.membership.id) {
      return NextResponse.json({ error: "You can only delete your own announcements" }, { status: 403 });
    }
    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      tenantCtx.role !== "TEACHER" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.announcement.delete({ where: { id } });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "ANNOUNCEMENT_DELETED",
      resource: "Announcement",
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}
