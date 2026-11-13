import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/tenant";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const createAnnouncementSchema = z.object({
  title: z.string().min(2, "Заголовок должен содержать минимум 2 символа").max(200),
  body: z.string().min(5, "Текст объявления должен содержать минимум 5 символов"),
  audience: z.enum(["ALL_CENTERS", "ROLES", "CENTERS"]).default("ALL_CENTERS"),
  targetRoles: z.array(z.string()).optional(),
  centerIds: z.array(z.string()).optional(),
  publishedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

const patchAnnouncementSchema = z.object({
  id: z.string().uuid("Некорректный ID объявления"),
  title: z.string().min(2).max(200).optional(),
  body: z.string().min(5).optional(),
  audience: z.enum(["ALL_CENTERS", "ROLES", "CENTERS"]).optional(),
  targetRoles: z.array(z.string()).optional(),
  centerIds: z.array(z.string()).optional(),
  publishedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const deleteAnnouncementSchema = z.object({
  id: z.string().uuid("Некорректный ID объявления"),
  reason: z.string().min(5, "Причина удаления обязательна (минимум 5 символов)").max(500),
});

export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session || !hasPermission("platform.announcements.read", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const skip = (page - 1) * limit;

    const [total, announcements] = await Promise.all([
      db.platformAnnouncement.count(),
      db.platformAnnouncement.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, fullName: true, email: true, platformRole: true } },
          _count: { select: { reads: true } },
        },
      }),
    ]);

    return NextResponse.json({
      announcements,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/platform/announcements error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session || !hasPermission("platform.announcements.manage", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip, 10, 60000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const raw = await req.json();
    const parsed = createAnnouncementSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;
    const announcement = await db.platformAnnouncement.create({
      data: {
        title: data.title,
        body: data.body,
        audience: data.audience,
        targetRoles: data.targetRoles ? JSON.stringify(data.targetRoles) : null,
        centerIds: data.centerIds ? JSON.stringify(data.centerIds) : null,
        publishedAt: data.publishedAt ? new Date(data.publishedAt) : new Date(),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        createdBy: session.user.id,
      },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_ANNOUNCEMENT_CREATED",
      resource: "PlatformAnnouncement",
      resourceId: announcement.id,
      details: {
        title: announcement.title,
        audience: announcement.audience,
      },
    });

    return NextResponse.json({ success: true, announcement }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/platform/announcements error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session || !hasPermission("platform.announcements.manage", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    const raw = await req.json();
    const parsed = patchAnnouncementSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { id, ...updates } = parsed.data;

    const existing = await db.platformAnnouncement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    const updated = await db.platformAnnouncement.update({
      where: { id },
      data: {
        title: updates.title,
        body: updates.body,
        audience: updates.audience,
        targetRoles: updates.targetRoles ? JSON.stringify(updates.targetRoles) : undefined,
        centerIds: updates.centerIds ? JSON.stringify(updates.centerIds) : undefined,
        publishedAt: updates.publishedAt ? new Date(updates.publishedAt) : undefined,
        expiresAt: updates.expiresAt !== undefined ? (updates.expiresAt ? new Date(updates.expiresAt) : null) : undefined,
      },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_ANNOUNCEMENT_UPDATED",
      resource: "PlatformAnnouncement",
      resourceId: updated.id,
      details: { title: updated.title },
    });

    return NextResponse.json({ success: true, announcement: updated });
  } catch (err: unknown) {
    console.error("PATCH /api/platform/announcements error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session || !hasPermission("platform.announcements.manage", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    const raw = await req.json();
    const parsed = deleteAnnouncementSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { id, reason } = parsed.data;

    const existing = await db.platformAnnouncement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    await db.platformAnnouncement.delete({ where: { id } });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_ANNOUNCEMENT_DELETED",
      resource: "PlatformAnnouncement",
      resourceId: id,
      details: {
        title: existing.title,
        reason,
      },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    console.error("DELETE /api/platform/announcements error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
