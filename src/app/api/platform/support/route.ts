import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import type { Prisma, TicketStatus, TicketPriority } from "@prisma/client";
import { z } from "zod";

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.support", req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim() || "";
    const priority = searchParams.get("priority")?.trim() || "";
    const search = searchParams.get("search")?.trim() || "";
    const unansweredOnly = searchParams.get("unanswered") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const where: Prisma.SupportTicketWhereInput = {};

    if (status && status !== "ALL") {
      where.status = status as TicketStatus;
    }

    if (priority && priority !== "ALL") {
      where.priority = priority as TicketPriority;
    }

    if (unansweredOnly) {
      where.status = { in: ["OPEN", "IN_PROGRESS"] };
      where.createdAt = { lte: twentyFourHoursAgo };
    }

    if (search) {
      where.OR = [
        { subject: { contains: search, mode: "insensitive" } },
        { creator: { fullName: { contains: search, mode: "insensitive" } } },
        { center: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [tickets, totalCount, unansweredCount] = await Promise.all([
      db.supportTicket.findMany({
        where,
        include: {
          creator: { select: { fullName: true, email: true } },
          center: { select: { id: true, name: true, slug: true } },
          assignedTo: { select: { id: true, fullName: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.supportTicket.count({ where }),
      db.supportTicket.count({
        where: {
          status: { in: ["OPEN", "IN_PROGRESS"] },
          createdAt: { lte: twentyFourHoursAgo },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      tickets,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      unansweredCount,
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = z
      .object({
        subject: z.string().min(2, "Тема должна содержать минимум 2 символа").max(200),
        message: z.string().min(5, "Сообщение должно содержать минимум 5 символов"),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().default("MEDIUM"),
        centerId: z.string().uuid().optional(),
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const { subject, message, priority, centerId } = parsed.data;
    const isPlatformStaff = hasPermission("platform.support", session.user.platformRole);
    const resolvedCenterId = isPlatformStaff
      ? centerId || session.activeCenterId || null
      : session.activeCenterId || null;

    const ticket = await db.supportTicket.create({
      data: {
        subject,
        priority,
        centerId: resolvedCenterId,
        creatorUserId: session.user.id,
        status: "OPEN",
        messages: {
          create: {
            message,
            senderUserId: session.user.id,
            isInternal: false,
          },
        },
      },
      include: {
        creator: { select: { fullName: true, email: true } },
        center: { select: { id: true, name: true, slug: true } },
        messages: true,
      },
    });

    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
