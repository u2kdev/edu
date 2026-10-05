import { NextResponse } from "next/server";
// Reason: Exception: Support tickets are platform-level models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/tenant";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ticket = await db.supportTicket.findUnique({
      where: { id: params.id },
      include: {
        creator: { select: { fullName: true, email: true } },
        center: { select: { name: true, slug: true } },
        messages: { orderBy: { createdAt: "asc" } },
      }
    });

    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPlatformStaff =
      session.user.platformRole === "SUPERADMIN" ||
      session.user.platformRole === "PLATFORM_ADMIN" ||
      session.user.platformRole === "PLATFORM_SUPPORT";

    const isCreator = ticket.creatorUserId === session.user.id;
    const isTenantAdmin = session.activeCenterId === ticket.centerId && 
      (session.activeCenterRole === "DIRECTOR" || session.activeCenterRole === "CENTER_ADMIN");

    if (!isPlatformStaff && !isCreator && !isTenantAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ ticket });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ticket = await db.supportTicket.findUnique({ where: { id: params.id } });
    if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const isPlatformStaff =
      session.user.platformRole === "SUPERADMIN" ||
      session.user.platformRole === "PLATFORM_ADMIN" ||
      session.user.platformRole === "PLATFORM_SUPPORT";

    const isCreator = ticket.creatorUserId === session.user.id;
    const isTenantAdmin = session.activeCenterId === ticket.centerId && 
      (session.activeCenterRole === "DIRECTOR" || session.activeCenterRole === "CENTER_ADMIN");

    if (!isPlatformStaff && !isCreator && !isTenantAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { status } = await req.json();

    const updated = await db.supportTicket.update({
      where: { id: params.id },
      data: { status }
    });

    await logAuditEvent({
      centerId: session.activeCenterId,
      actorUserId: session.user.id,
      action: "TICKET_UPDATED",
      resource: "SupportTicket",
      resourceId: updated.id,
      details: { status },
    });

    return NextResponse.json({ success: true, ticket: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
