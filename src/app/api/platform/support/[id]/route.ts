import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";
import type { TicketStatus, TicketPriority } from "@prisma/client";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requirePlatformPermission("platform.support", req);

    const ticket = await db.supportTicket.findUnique({
      where: { id: params.id },
      include: {
        creator: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        center: {
          select: { id: true, name: true, slug: true, status: true },
        },
        assignedTo: {
          select: { id: true, fullName: true, email: true, platformRole: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          include: {
            sender: {
              select: { id: true, fullName: true, email: true, platformRole: true },
            },
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ success: false, error: "Тикет не найден" }, { status: 404 });
    }

    // Also get platform staff for assignment dropdown
    const staff = await db.platformUser.findMany({
      where: {
        platformRole: { in: ["SUPERADMIN", "DEVELOPER", "PLATFORM_ADMIN", "PLATFORM_SUPPORT", "FULL_ACCESS"] },
        deletedAt: null,
      },
      select: { id: true, fullName: true, email: true, platformRole: true },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json({
      success: true,
      ticket,
      staff,
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedToId: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePlatformPermission("platform.support", req);
    const body = await req.json();
    const validated = updateTicketSchema.parse(body);

    const ticket = await db.supportTicket.findUnique({
      where: { id: params.id },
    });

    if (!ticket) {
      return NextResponse.json({ success: false, error: "Тикет не найден" }, { status: 404 });
    }

    const updated = await db.supportTicket.update({
      where: { id: params.id },
      data: {
        ...(validated.status && { status: validated.status as TicketStatus }),
        ...(validated.priority && { priority: validated.priority as TicketPriority }),
        ...(validated.assignedToId !== undefined && { assignedToId: validated.assignedToId }),
      },
      include: {
        creator: { select: { fullName: true, email: true } },
        assignedTo: { select: { fullName: true, email: true } },
      },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_TICKET_UPDATED",
      resource: "SupportTicket",
      resourceId: ticket.id,
      details: {
        status: validated.status,
        priority: validated.priority,
        assignedToId: validated.assignedToId,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      ticket: updated,
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
