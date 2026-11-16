import { NextResponse } from "next/server";
// Reason: Exception: Support tickets are platform-level models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/tenant";
import type { TicketPriority, TicketScope } from "@prisma/client";

const TICKET_PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const TICKET_SCOPES: TicketScope[] = ["TENANT", "PLATFORM"];

// GET /api/tickets - List support tickets for current user or tenant/platform
export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isPlatformStaff = hasPermission("platform.support", session.user.platformRole);

    let tickets;

    if (isPlatformStaff) {
      tickets = await db.supportTicket.findMany({
        include: {
          creator: { select: { fullName: true, email: true } },
          center: { select: { name: true, slug: true } },
          messages: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      const isCenterAdminOrDirector =
        session.activeCenterRole === "DIRECTOR" ||
        session.activeCenterRole === "CENTER_ADMIN" ||
        session.activeCenterRole === "CENTER_SUPPORT";

      tickets = await db.supportTicket.findMany({
        where: isCenterAdminOrDirector
          ? { centerId: session.activeCenterId }
          : {
              creatorUserId: session.user.id,
              ...(session.activeCenterId ? { centerId: session.activeCenterId } : {}),
            },
        include: {
          creator: { select: { fullName: true, email: true } },
          messages: {
            where: { isInternal: false },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({ tickets });
  } catch (err: unknown) {
    console.error("[GET /api/tickets]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/tickets - Create a support ticket
export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { subject, message, priority, scope } = await req.json();

    if (!subject || !message) {
      return NextResponse.json({ error: "Subject and initial message are required" }, { status: 400 });
    }

    const ticket = await db.supportTicket.create({
      data: {
        centerId: session.activeCenterId || null,
        creatorUserId: session.user.id,
        subject,
        priority: TICKET_PRIORITIES.includes(priority) ? priority : "MEDIUM",
        scope: TICKET_SCOPES.includes(scope) ? scope : "TENANT",
        status: "OPEN",
        messages: {
          create: {
            senderUserId: session.user.id,
            message,
            isInternal: false,
          },
        },
      },
      include: {
        messages: {
          where: { isInternal: false },
        },
      },
    });

    await logAuditEvent({
      centerId: session.activeCenterId,
      actorUserId: session.user.id,
      action: "TICKET_CREATED",
      resource: "SupportTicket",
      resourceId: ticket.id,
      details: { subject, scope },
    });

    return NextResponse.json({ success: true, ticket });
  } catch (err: unknown) {
    console.error("[GET /api/tickets]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
