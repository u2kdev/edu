import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { NotificationType } from "@prisma/client";

const createMessageSchema = z.object({
  message: z.string().min(1, "Сообщение не может быть пустым"),
  isInternal: z.boolean().default(false),
  attachmentsJson: z.string().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePlatformPermission("platform.support", req);
    const body = await req.json();
    const validated = createMessageSchema.parse(body);

    const ticket = await db.supportTicket.findUnique({
      where: { id: params.id },
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!ticket) {
      return NextResponse.json({ success: false, error: "Тикет не найден" }, { status: 404 });
    }

    const message = await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderUserId: session.user.id,
        message: validated.message,
        isInternal: validated.isInternal,
        attachmentsJson: validated.attachmentsJson || null,
      },
      include: {
        sender: {
          select: { id: true, fullName: true, email: true, platformRole: true },
        },
      },
    });

    // If it's a client-facing reply (not internal note):
    if (!validated.isInternal) {
      // If ticket was OPEN, transition to IN_PROGRESS
      if (ticket.status === "OPEN") {
        await db.supportTicket.update({
          where: { id: ticket.id },
          data: { status: "IN_PROGRESS" },
        });
      }

      // Notify the ticket author
      if (ticket.creatorUserId !== session.user.id) {
        await db.notification.create({
          data: {
            userId: ticket.creatorUserId,
            centerId: ticket.centerId,
            type: NotificationType.GENERAL,
            titleKey: "support.ticket_reply.title",
            bodyKey: "support.ticket_reply.body",
            bodyParams: JSON.stringify({
              ticketId: ticket.id,
              subject: ticket.subject,
              senderName: session.user.fullName || "Служба поддержки",
            }),
            sentAt: new Date(),
          },
        });

        if (ticket.creator.email) {
          await db.emailOutbox.create({
            data: {
              to: ticket.creator.email,
              subject: `Новый ответ по тикету: ${ticket.subject}`,
              body: `Здравствуйте, ${ticket.creator.fullName}!\n\nПо вашему обращению в службу поддержки поступил новый ответ:\n\n"${validated.message}"\n\nВы можете ознакомиться с ответом в личном кабинете.`,
            },
          });
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message,
        ticketMessage: message,
      },
      { status: 201 }
    );
  } catch (err) {
    return handlePlatformError(err);
  }
}
