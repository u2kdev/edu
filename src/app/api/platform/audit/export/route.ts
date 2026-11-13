import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import type { Prisma } from "@prisma/client";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.audit.read", req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const action = searchParams.get("action")?.trim() || "";
    const centerId = searchParams.get("centerId")?.trim() || "";
    const resource = searchParams.get("resource")?.trim() || "";
    const ipAddress = searchParams.get("ipAddress")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";

    const where: Prisma.AuditLogWhereInput = {};

    if (action && action !== "ALL") where.action = action;
    if (centerId && centerId !== "ALL") where.centerId = centerId;
    if (resource && resource !== "ALL") where.resource = resource;
    if (ipAddress) where.ipAddress = { contains: ipAddress };

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

    const logs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 2000,
      include: {
        actor: { select: { fullName: true, email: true, platformRole: true } },
        center: { select: { name: true } },
      },
    });

    const headers = [
      "Дата и время",
      "Действие",
      "Инициатор",
      "Email инициатора",
      "Роль",
      "Учебный центр",
      "Ресурс",
      "ID ресурса",
      "IP-адрес",
      "Детали",
    ];

    const rows = logs.map((l) => [
      escapeCsv(l.createdAt.toISOString()),
      escapeCsv(l.action),
      escapeCsv(l.actor?.fullName || "—"),
      escapeCsv(l.actor?.email || "—"),
      escapeCsv(l.actor?.platformRole || "—"),
      escapeCsv(l.center?.name || "Платформа"),
      escapeCsv(l.resource),
      escapeCsv(l.resourceId || "—"),
      escapeCsv(l.ipAddress || "—"),
      escapeCsv(l.detailsJson || "—"),
    ]);

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
