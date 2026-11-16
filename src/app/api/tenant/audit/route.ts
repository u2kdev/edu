import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import { generateCsv } from "@/lib/csv";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!hasPermission("audit.read", tenantCtx.session.user.platformRole, tenantCtx.role)) {
      return NextResponse.json({ error: "Forbidden: No permission to read audit logs" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);

    const search = searchParams.get("search")?.trim() || "";
    const action = searchParams.get("action")?.trim() || "";
    const actorUserId = searchParams.get("actorUserId")?.trim() || "";
    const resource = searchParams.get("resource")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";
    const isExport = searchParams.get("export") === "csv";

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = isExport
      ? 1000
      : Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    // Strict multi-tenant isolation: ALWAYS scoped to tenantCtx.center.id
    const where: Prisma.AuditLogWhereInput = {
      centerId: tenantCtx.center.id,
    };

    if (action && action !== "ALL") {
      where.action = action;
    }

    if (actorUserId && actorUserId !== "ALL") {
      where.actorUserId = actorUserId;
    }

    if (resource && resource !== "ALL") {
      where.resource = resource;
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
      ];
    }

    const [logs, totalCount, actionsGroup, resourcesGroup, centerMembers] = await Promise.all([
      tenantCtx.getTenantDb().auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          actor: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),
      tenantCtx.getTenantDb().auditLog.count({ where }),
      tenantCtx.getTenantDb().auditLog.groupBy({
        by: ["action"],
        where: { centerId: tenantCtx.center.id },
      }),
      tenantCtx.getTenantDb().auditLog.groupBy({
        by: ["resource"],
        where: { centerId: tenantCtx.center.id },
      }),
      tenantCtx.getTenantDb().centerMembership.findMany({
        where: { centerId: tenantCtx.center.id },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    if (isExport) {
      const header = ["Timestamp", "Actor", "Action", "Resource", "Resource ID", "IP Address", "Details"];

      const rows = logs.map((l) => [
        l.createdAt.toISOString(),
        l.actor ? `${l.actor.fullName} (${l.actor.email})` : "System",
        l.action,
        l.resource,
        l.resourceId,
        l.ipAddress,
        l.detailsJson,
      ]);

      const csvContent = generateCsv(header, rows);

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="center_audit_${tenantCtx.center.slug}_${new Date().toISOString().slice(0, 10)}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const distinctActors = Array.from(
      new Map(centerMembers.map((m) => [m.user.id, m.user])).values()
    );

    return NextResponse.json(
      {
        logs,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit) || 1,
        },
        filters: {
          actions: actionsGroup.map((a) => a.action).filter(Boolean),
          resources: resourcesGroup.map((r) => r.resource).filter(Boolean),
          actors: distinctActors,
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
