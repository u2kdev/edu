import { NextResponse } from "next/server";
// Reason: Exception: Support tickets are platform-level models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/tenant";

// GET /api/tickets - List support tickets for current user or tenant/platform
export async function GET(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const isPlatformStaff =
      session.user.platformRole === "SUPERADMIN" ||
      session.user.platformRole === "PLATFORM_ADMIN" ||
      session.user.platformRole === "PLATFORM_SUPPORT";

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
      tickets = await db.supportTicket.findMany({
        where: {
          OR: [
            { creatorUserId: session.user.id },
            ...(session.activeCenterId ? [{ centerId: session.activeCenterId }] : []),
          ],
        },
        include: {
          creator: { select: { fullName: true, email: true } },
          messages: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return NextResponse.json({ tickets });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// POST /api/tickets - Create a support ticket
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
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
        priority: priority || "MEDIUM",
        scope: scope || "TENANT",
        status: "OPEN",
        messages: {
          create: {
            senderUserId: session.user.id,
            message,
          },
        },
      },
      include: {
        messages: true,
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
