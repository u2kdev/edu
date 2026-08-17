import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

// GET /api/notifications - Get user notifications (tenant-scoped, paginated)
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(50, parseInt(searchParams.get("pageSize") || "20"));
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const whereCondition: any = {
      userId: session.user.id,
      // Show notifications for the active center or global (centerId: null) ones
      ...(session.activeCenterId
        ? { OR: [{ centerId: session.activeCenterId }, { centerId: null }] }
        : { centerId: null }),
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await db.$transaction([
      db.notification.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          type: true,
          titleKey: true,
          bodyKey: true,
          bodyParams: true,
          channel: true,
          isRead: true,
          centerId: true,
          createdAt: true,
        },
      }),
      db.notification.count({ where: whereCondition }),
      db.notification.count({ where: { userId: session.user.id, isRead: false } }),
    ]);

    return NextResponse.json({ notifications, total, page, pageSize, unreadCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { notificationId, markAllRead } = await req.json();

    if (markAllRead) {
      await db.notification.updateMany({
        where: {
          userId: session.user.id,
          isRead: false,
          // Scope to active center
          ...(session.activeCenterId
            ? { OR: [{ centerId: session.activeCenterId }, { centerId: null }] }
            : {}),
        },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      // SECURITY: Verify the notification belongs to this user (prevent IDOR)
      const notification = await db.notification.findFirst({
        where: { id: notificationId, userId: session.user.id },
      });
      if (!notification) {
        return NextResponse.json({ error: "Notification not found" }, { status: 404 });
      }
      await db.notification.update({
        where: { id: notificationId },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Provide notificationId or markAllRead: true" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
