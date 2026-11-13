import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import type { Prisma, SubscriptionStatus } from "@prisma/client";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.billing.read", req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";

    const where: Prisma.SubscriptionWhereInput = {};

    if (status && status !== "ALL") {
      where.status = status as SubscriptionStatus;
    }

    if (search) {
      where.OR = [
        { center: { name: { contains: search, mode: "insensitive" } } },
        { center: { slug: { contains: search, mode: "insensitive" } } },
        { plan: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const subs = await db.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 2000,
      include: {
        center: { select: { id: true, name: true, slug: true, status: true } },
        plan: true,
      },
    });

    const headers = [
      "ID подписки",
      "Учебный центр",
      "Slug центра",
      "Статус центра",
      "Тарифный план",
      "Цена в месяц (UZS)",
      "Статус подписки",
      "Начало периода",
      "Конец периода",
      "Автопродление",
      "Дата создания",
    ];

    const rows = subs.map((s) => [
      escapeCsv(s.id),
      escapeCsv(s.center.name),
      escapeCsv(s.center.slug),
      escapeCsv(s.center.status),
      escapeCsv(s.plan.name),
      escapeCsv(s.plan.priceMonthly),
      escapeCsv(s.status),
      escapeCsv(s.currentPeriodStartsAt.toISOString().slice(0, 10)),
      escapeCsv(s.currentPeriodEndsAt.toISOString().slice(0, 10)),
      escapeCsv(s.autoRenew ? "Да" : "Нет"),
      escapeCsv(s.createdAt.toISOString().slice(0, 10)),
    ]);

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="subscriptions-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
