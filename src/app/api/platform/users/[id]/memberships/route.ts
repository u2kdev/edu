import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";
import type { MembershipRole, MembershipStatus } from "@prisma/client";

const addMembershipSchema = z.object({
  centerId: z.string().min(1, "ID центра обязателен"),
  role: z.enum([
    "DIRECTOR",
    "CENTER_ADMIN",
    "ACCOUNTANT",
    "TEACHER",
    "TEACHER_ASSISTANT",
    "CENTER_SUPPORT",
    "STUDENT",
    "PARENT",
  ]),
});

const patchMembershipSchema = z.object({
  membershipId: z.string().min(1),
  role: z
    .enum([
      "DIRECTOR",
      "CENTER_ADMIN",
      "ACCOUNTANT",
      "TEACHER",
      "TEACHER_ASSISTANT",
      "CENTER_SUPPORT",
      "STUDENT",
      "PARENT",
    ])
    .optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"]).optional(),
});

const deleteMembershipSchema = z.object({
  membershipId: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission("platform.users.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id: userId } = params;
    const body = await req.json();
    const parsed = addMembershipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const { centerId, role } = parsed.data;

    const center = await db.learningCenter.findUnique({ where: { id: centerId } });
    if (!center) return NextResponse.json({ error: "Учебный центр не найден" }, { status: 404 });

    const existing = await db.centerMembership.findFirst({
      where: { userId, centerId },
    });

    if (existing) {
      const updated = await db.centerMembership.update({
        where: { id: existing.id },
        data: { role: role as MembershipRole, status: "ACTIVE" },
      });
      return NextResponse.json({ success: true, membership: updated });
    }

    const membership = await db.centerMembership.create({
      data: {
        userId,
        centerId,
        role: role as MembershipRole,
        status: "ACTIVE",
      },
      include: {
        center: { select: { id: true, name: true, slug: true } },
      },
    });

    await logAuditEvent({
      action: "CENTER_MEMBERSHIP_CREATED",
      resource: "CenterMembership",
      resourceId: membership.id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: { userId, centerId, role },
    });

    return NextResponse.json({ success: true, membership }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/platform/users/[id]/memberships]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission("platform.users.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id: userId } = params;
    const body = await req.json();
    const parsed = patchMembershipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const { membershipId, role, status } = parsed.data;

    const membership = await db.centerMembership.findUnique({
      where: { id: membershipId },
      include: { center: true },
    });

    if (!membership || membership.userId !== userId) {
      return NextResponse.json({ error: "Членство не найдено" }, { status: 404 });
    }

    // Protection: Center cannot be left without director if demoting or suspending director
    if (membership.role === "DIRECTOR" && (role !== "DIRECTOR" || (status && status !== "ACTIVE"))) {
      const otherDirectorsCount = await db.centerMembership.count({
        where: {
          centerId: membership.centerId,
          role: "DIRECTOR",
          status: "ACTIVE",
          id: { not: membership.id },
        },
      });
      if (otherDirectorsCount === 0) {
        return NextResponse.json(
          { error: "Нельзя изменить роль или отозвать единственного директора центра без назначения нового" },
          { status: 400 }
        );
      }
    }

    const updated = await db.centerMembership.update({
      where: { id: membershipId },
      data: {
        ...(role ? { role: role as MembershipRole } : {}),
        ...(status ? { status: status as MembershipStatus } : {}),
      },
    });

    await logAuditEvent({
      action: "CENTER_MEMBERSHIP_UPDATED",
      resource: "CenterMembership",
      resourceId: membership.id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: { userId, centerId: membership.centerId, role, status },
    });

    return NextResponse.json({ success: true, membership: updated });
  } catch (error) {
    console.error("[PATCH /api/platform/users/[id]/memberships]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission("platform.users.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id: userId } = params;
    const body = await req.json();
    const parsed = deleteMembershipSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "membershipId is required" }, { status: 400 });
    }

    const { membershipId } = parsed.data;

    const membership = await db.centerMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership || membership.userId !== userId) {
      return NextResponse.json({ error: "Членство не найдено" }, { status: 404 });
    }

    if (membership.role === "DIRECTOR") {
      const otherDirectorsCount = await db.centerMembership.count({
        where: {
          centerId: membership.centerId,
          role: "DIRECTOR",
          status: "ACTIVE",
          id: { not: membership.id },
        },
      });
      if (otherDirectorsCount === 0) {
        return NextResponse.json(
          { error: "Нельзя удалить единственного директора центра" },
          { status: 400 }
        );
      }
    }

    await db.centerMembership.delete({ where: { id: membershipId } });

    await logAuditEvent({
      action: "CENTER_MEMBERSHIP_DELETED",
      resource: "CenterMembership",
      resourceId: membershipId,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: { userId, centerId: membership.centerId },
    });

    return NextResponse.json({ success: true, message: "Членство удалено" });
  } catch (error) {
    console.error("[DELETE /api/platform/users/[id]/memberships]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
