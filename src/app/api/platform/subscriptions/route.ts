import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformOwner, handlePlatformError } from "@/lib/platformAuth";

export async function GET(req: Request) {
  try {
    await requirePlatformOwner();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }

    const [total, subscriptions] = await Promise.all([
      db.subscription.count({ where }),
      db.subscription.findMany({
        where,
        orderBy: { currentPeriodEndsAt: "asc" },
        skip,
        take: limit,
        include: {
          center: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              priceMonthly: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      subscriptions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
