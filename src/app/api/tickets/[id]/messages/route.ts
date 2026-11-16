import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Support tickets are platform-level models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/tenant";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";

const createMessageSchema = z.object({
  message: z.string().min(1, "Сообщение не может быть пустым"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ip = getClientIp(req);
    if (!(await checkRateLimit(ip + "_ticket_msg", 30, 60))) {
      return apiError("Слишком много сообщений. Пожалуйста, подождите.", "RATE_LIMITED", 429);
    }

    const session = await getAuthSession(req);
    if (!session) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    const ticket = await db.supportTicket.findUnique({
      where: { id: params.id },
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!ticket) return apiError("Тикет не найден", "NOT_FOUND", 404);

    const isPlatformStaff = hasPermission("platform.support", session.user.platformRole);

    const isCreator = ticket.creatorUserId === session.user.id;
    const isTenantAdmin =
      session.activeCenterId === ticket.centerId &&
      (session.activeCenterRole === "DIRECTOR" || session.activeCenterRole === "CENTER_ADMIN");

    if (!isPlatformStaff && !isCreator && !isTenantAdmin) {
      return apiError("Доступ запрещен", "FORBIDDEN", 403);
    }

    const body = await req.json();
    const validated = createMessageSchema.parse(body);

    const message = await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderUserId: session.user.id,
        message: validated.message,
        isInternal: false,
      },
      include: {
        sender: {
          select: { id: true, fullName: true, email: true, platformRole: true },
        },
      },
    });

    // If ticket was resolved/closed, user reply can reopen it to IN_PROGRESS
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      await db.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    await logAuditEvent({
      centerId: session.activeCenterId || ticket.centerId || undefined,
      actorUserId: session.user.id,
      action: "TICKET_MESSAGE_SENT",
      resource: "SupportTicket",
      resourceId: ticket.id,
      details: {
        messageId: message.id,
        isReopened: ticket.status === "RESOLVED" || ticket.status === "CLOSED",
      },
    });

    return apiSuccess({ message }, 201);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
