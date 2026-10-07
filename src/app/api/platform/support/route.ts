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

    let whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }

    const tickets = await db.supportTicket.findMany({
      where: whereClause,
      include: {
        creator: { select: { fullName: true, email: true } },
        center: { select: { name: true, slug: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requirePlatformOwner();
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: "Ticket ID and status required" }, { status: 400 });
    }

    const ticket = await db.supportTicket.update({
      where: { id },
      data: { status },
      include: { creator: { select: { fullName: true, email: true } } },
    });

    // Optionally add an audit log for ticket status change
    await db.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "PLATFORM_TICKET_UPDATED",
        resource: "SupportTicket",
        resourceId: ticket.id,
        detailsJson: JSON.stringify({ status }),
      },
    });

    return NextResponse.json({ success: true, ticket });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}
