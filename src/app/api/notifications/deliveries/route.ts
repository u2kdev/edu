import { NextResponse } from "next/server";
import type { DeliveryStatus, NotificationChannel, Prisma } from "@prisma/client";
import { requireTenantAccess, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

const ALLOWED_CHANNELS = new Set<NotificationChannel>(["IN_APP", "EMAIL", "SMS", "PUSH", "TELEGRAM"]);
const ALLOWED_STATUSES = new Set<DeliveryStatus>(["PENDING", "SENT", "FAILED", "DEFERRED", "SKIPPED"]);

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { role, session, center } = tenantCtx;

    const canViewCenterLogs =
      hasPermission("settings.read", session.user.platformRole, role) ||
      hasPermission("reports.read", session.user.platformRole, role) ||
      role === "DIRECTOR" ||
      role === "CENTER_ADMIN" ||
      role === "ACCOUNTANT" ||
      role === "CENTER_SUPPORT" ||
      tenantCtx.isPlatformStaff;

    if (!canViewCenterLogs) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient permissions to view delivery logs" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20));
    const channelParam = searchParams.get("channel") || "";
    const statusParam = searchParams.get("status") || "";
    const search = (searchParams.get("search") || "").trim();

    const where: Prisma.NotificationDeliveryWhereInput = {
      centerId: center.id,
      ...(ALLOWED_CHANNELS.has(channelParam as NotificationChannel)
        ? { channel: channelParam as NotificationChannel }
        : {}),
      ...(ALLOWED_STATUSES.has(statusParam as DeliveryStatus)
        ? { status: statusParam as DeliveryStatus }
        : {}),
      ...(search
        ? {
            OR: [
              { subject: { contains: search, mode: "insensitive" } },
              { recipient: { contains: search, mode: "insensitive" } },
              { eventKey: { contains: search, mode: "insensitive" } },
              { user: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const tenantDb = tenantCtx.getTenantDb();
    const [deliveries, total] = await Promise.all([
      tenantDb.notificationDelivery.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tenantDb.notificationDelivery.count({ where }),
    ]);

    return NextResponse.json(
      {
        deliveries: deliveries.map((d) => ({
          id: d.id,
          userId: d.userId,
          userName: d.user?.fullName ?? null,
          channel: d.channel,
          type: d.type,
          eventKey: d.eventKey,
          recipient: d.recipient,
          subject: d.subject,
          status: d.status,
          providerMessageId: d.providerMessageId,
          errorMessage: d.errorMessage,
          deferredUntil: d.deferredUntil ? d.deferredUntil.toISOString() : null,
          sentAt: d.sentAt ? d.sentAt.toISOString() : null,
          createdAt: d.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    console.error("[GET /api/notifications/deliveries]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
