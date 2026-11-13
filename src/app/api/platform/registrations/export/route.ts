import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.users.read", req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const type = searchParams.get("type")?.trim() || "ALL";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }

    const headers = [
      "Тип объекта",
      "ФИО / Название",
      "Email",
      "Телефон",
      "Роль",
      "Учебный центр",
      "Email подтверждён",
      "Дата регистрации",
    ];

    const rows: string[][] = [];

    if (type !== "CENTERS" && type !== "CENTER") {
      const users = await db.platformUser.findMany({
        where: {
          deletedAt: null,
          ...(dateFrom || dateTo ? { createdAt: dateFilter } : {}),
          ...(search ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
            ],
          } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
        include: {
          memberships: {
            where: { status: "ACTIVE" },
            include: { center: { select: { name: true } } },
            take: 1,
          },
        },
      });

      users.forEach((u) => {
        const mem = u.memberships[0];
        rows.push([
          escapeCsv("Пользователь"),
          escapeCsv(u.fullName),
          escapeCsv(u.email || "—"),
          escapeCsv(u.phone || "—"),
          escapeCsv(u.platformRole !== "NONE" ? u.platformRole : mem?.role || "USER"),
          escapeCsv(mem?.center.name || "—"),
          escapeCsv(u.emailVerified ? "Да" : "Нет"),
          escapeCsv(u.createdAt.toISOString().slice(0, 10)),
        ]);
      });
    }

    if (type !== "USERS" && type !== "USER") {
      const centers = await db.learningCenter.findMany({
        where: {
          ...(dateFrom || dateTo ? { createdAt: dateFilter } : {}),
          ...(search ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
            ],
          } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
        include: {
          owner: { select: { fullName: true, email: true, phone: true } },
        },
      });

      centers.forEach((c) => {
        rows.push([
          escapeCsv("Учебный центр"),
          escapeCsv(c.name),
          escapeCsv(c.email || c.owner.email || "—"),
          escapeCsv(c.phone || c.owner.phone || "—"),
          escapeCsv("Владелец: " + c.owner.fullName),
          escapeCsv(c.name),
          escapeCsv("Да"),
          escapeCsv(c.createdAt.toISOString().slice(0, 10)),
        ]);
      });
    }

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="registrations-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
