import { NextResponse } from "next/server";
// Reason: Exception: Support tickets are platform-level models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { logAuditEvent } from "@/lib/tenant";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { z } from "zod";

const ticketPatchSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const ticket = await db.supportTicket.findUnique({
      where: { id: params.id },
      include: {
        creator: { select: { fullName: true, email: true } },
        center: { select: { name: true, slug: true } },
        messages: { orderBy: { createdAt: "asc" } },
      }
    });

    if (!ticket) return apiError("Not found", "NOT_FOUND", 404);

    const isPlatformStaff =
      session.user.platformRole === "SUPERADMIN" ||
      session.user.platformRole === "PLATFORM_ADMIN" ||
      session.user.platformRole === "PLATFORM_SUPPORT";

    const isCreator = ticket.creatorUserId === session.user.id;
    const isTenantAdmin = session.activeCenterId === ticket.centerId && 
      (session.activeCenterRole === "DIRECTOR" || session.activeCenterRole === "CENTER_ADMIN");

    if (!isPlatformStaff && !isCreator && !isTenantAdmin) {
      return apiError("Not found", "NOT_FOUND", 404);
    }

    return apiSuccess({ ticket });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip + "_ticket_patch")) {
      return apiError("Rate limited", "RATE_LIMITED", 429);
    }

    const session = await getAuthSession();
    if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const ticket = await db.supportTicket.findUnique({ where: { id: params.id } });
    if (!ticket) return apiError("Not found", "NOT_FOUND", 404);

    const isPlatformStaff =
      session.user.platformRole === "SUPERADMIN" ||
      session.user.platformRole === "PLATFORM_ADMIN" ||
      session.user.platformRole === "PLATFORM_SUPPORT";

    const isCreator = ticket.creatorUserId === session.user.id;
    const isTenantAdmin = session.activeCenterId === ticket.centerId && 
      (session.activeCenterRole === "DIRECTOR" || session.activeCenterRole === "CENTER_ADMIN");

    if (!isPlatformStaff && !isCreator && !isTenantAdmin) {
      return apiError("Not found", "NOT_FOUND", 404);
    }

    const body = await req.json();
    const { status } = ticketPatchSchema.parse(body);

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

    return apiSuccess({ ticket: updated });
  } catch (err: any) {
    return handleApiError(err);
  }
}
