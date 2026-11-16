import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { generateCsv } from "@/lib/csv";

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
          "Пользователь",
          u.fullName,
          u.email || "—",
          u.phone || "—",
          u.platformRole !== "NONE" ? u.platformRole : mem?.role || "USER",
          mem?.center.name || "—",
          u.emailVerified ? "Да" : "Нет",
          u.createdAt.toISOString().slice(0, 10),
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
          "Учебный центр",
          c.name,
          c.email || c.owner.email || "—",
          c.phone || c.owner.phone || "—",
          "Владелец: " + c.owner.fullName,
          c.name,
          "Да",
          c.createdAt.toISOString().slice(0, 10),
        ]);
      });
    }

    const csvContent = generateCsv(headers, rows);

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
