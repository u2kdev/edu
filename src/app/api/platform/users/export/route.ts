import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { Prisma, PlatformRole, MembershipRole } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission("platform.users.read", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const platformRole = searchParams.get("platformRole")?.trim() || "";
    const centerRole = searchParams.get("centerRole")?.trim() || "";
    const centerId = searchParams.get("centerId")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "ALL";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";

    const where: Prisma.PlatformUserWhereInput = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }

    if (platformRole && platformRole !== "ALL") {
      where.platformRole = platformRole as PlatformRole;
    }

    if (status === "ACTIVE") {
      where.isActive = true;
      where.deletedAt = null;
    } else if (status === "BLOCKED") {
      where.isActive = false;
      where.deletedAt = null;
    } else if (status === "DELETED") {
      where.deletedAt = { not: null };
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

    if (centerId || centerRole) {
      where.memberships = {
        some: {
          ...(centerId ? { centerId } : {}),
          ...(centerRole && centerRole !== "ALL" ? { role: centerRole as MembershipRole } : {}),
          status: "ACTIVE",
        },
      };
    }

    const users = await db.platformUser.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        username: true,
        platformRole: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        lastLoginAt: true,
        memberships: {
          where: { status: "ACTIVE" },
          select: {
            role: true,
            center: { select: { name: true } },
          },
        },
      },
    });

    const headers = [
      "ID",
      "ФИО",
      "Email",
      "Телефон",
      "Username",
      "Роль платформы",
      "Роли и центры",
      "Статус",
      "Дата регистрации",
      "Последний вход",
    ];

    const escapeCsv = (str: string | null | undefined) => {
      if (!str) return '""';
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    const rows = users.map((u) => {
      let statusStr = "Активен";
      if (u.deletedAt) statusStr = "Удален";
      else if (!u.isActive) statusStr = "Заблокирован";

      const membershipsStr = u.memberships
        .map((m) => `${m.center.name} (${m.role})`)
        .join("; ");

      return [
        escapeCsv(u.id),
        escapeCsv(u.fullName),
        escapeCsv(u.email),
        escapeCsv(u.phone || "-"),
        escapeCsv(u.username || "-"),
        escapeCsv(u.platformRole),
        escapeCsv(membershipsStr || "-"),
        escapeCsv(statusStr),
        escapeCsv(u.createdAt.toISOString().slice(0, 10)),
        escapeCsv(u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 19).replace("T", " ") : "-"),
      ].join(",");
    });

    // UTF-8 BOM for Microsoft Excel compatibility
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="users_export_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    console.error("[GET /api/platform/users/export]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
