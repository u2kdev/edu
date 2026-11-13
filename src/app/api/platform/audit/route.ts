import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.audit.read", req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const action = searchParams.get("action")?.trim() || "";
    const actorUserId = searchParams.get("actorUserId")?.trim() || "";
    const centerId = searchParams.get("centerId")?.trim() || "";
    const resource = searchParams.get("resource")?.trim() || "";
    const ipAddress = searchParams.get("ipAddress")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (action && action !== "ALL") {
      where.action = action;
    }

    if (actorUserId && actorUserId !== "ALL") {
      where.actorUserId = actorUserId;
    }

    if (centerId && centerId !== "ALL") {
      where.centerId = centerId;
    }

    if (resource && resource !== "ALL") {
      where.resource = resource;
    }

    if (ipAddress) {
      where.ipAddress = { contains: ipAddress };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { resource: { contains: search, mode: "insensitive" } },
        { detailsJson: { contains: search, mode: "insensitive" } },
        { actor: { fullName: { contains: search, mode: "insensitive" } } },
        { center: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [logs, totalCount, actionsGroup] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          actor: {
            select: { id: true, fullName: true, email: true, platformRole: true },
          },
          center: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      db.auditLog.count({ where }),
      db.auditLog.groupBy({
        by: ["action"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 30,
      }),
    ]);

    const distinctActions = actionsGroup.map((a) => a.action);

    return NextResponse.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      distinctActions,
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
