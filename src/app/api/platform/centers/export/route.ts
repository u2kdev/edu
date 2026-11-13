import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import type { Prisma, CenterStatus, OrganizationKind } from "@prisma/client";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.centers.read", req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("q")?.trim() || searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const organizationKind = searchParams.get("organizationKind")?.trim() || "";

    const where: Prisma.LearningCenterWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { owner: { fullName: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status && status !== "ALL") {
      where.status = status as CenterStatus;
    }

    if (organizationKind && organizationKind !== "ALL") {
      where.organizationKind = organizationKind as OrganizationKind;
    }

    const centers = await db.learningCenter.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 2000,
      include: {
        owner: { select: { fullName: true, email: true, phone: true } },
        subscriptions: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: { plan: { select: { name: true, priceMonthly: true } } },
        },
        _count: {
          select: {
            memberships: { where: { role: "STUDENT", status: "ACTIVE" } },
          },
        },
      },
    });

    const headers = [
      "ID",
      "Название",
      "Slug",
      "Тип организации",
      "Формат",
      "Статус",
      "Владелец",
      "Email владельца",
      "Телефон",
      "ИНН",
      "Юр. лицо",
      "Тарифный план",
      "Активных учеников",
      "Дата создания",
    ];

    const rows = centers.map((c) => [
      escapeCsv(c.id),
      escapeCsv(c.name),
      escapeCsv(c.slug),
      escapeCsv(c.organizationKind),
      escapeCsv(c.centerType),
      escapeCsv(c.status),
      escapeCsv(c.owner.fullName),
      escapeCsv(c.owner.email),
      escapeCsv(c.phone || c.owner.phone || "—"),
      escapeCsv(c.inn || "—"),
      escapeCsv(c.legalName || "—"),
      escapeCsv(c.subscriptions[0]?.plan?.name || "Без тарифа"),
      escapeCsv(c._count.memberships),
      escapeCsv(c.createdAt.toISOString().slice(0, 10)),
    ]);

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="centers-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
