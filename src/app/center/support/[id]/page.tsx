import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import CenterTicketChat from "@/components/CenterTicketChat";

export default async function CenterTicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const tenantCtx = await requireTenantPageAccess({ allowSuspended: true });

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const ticket = await tenantCtx.getTenantDb().supportTicket.findUnique({
    where: { id: params.id },
    include: {
      creator: { select: { fullName: true, email: true } },
      messages: {
        where: { isInternal: false }, // Only client-facing messages
        orderBy: { createdAt: "asc" },
        include: {
          sender: {
            select: { fullName: true, email: true, platformRole: true },
          },
        },
      },
    },
  });

  if (!ticket) notFound();

  // Ensure this ticket belongs to the center and the actor is authorized:
  // - The creator of the ticket
  // - Center administration (DIRECTOR, CENTER_ADMIN, CENTER_SUPPORT)
  // - Platform staff
  const isCreator = ticket.creatorUserId === session.user.id;
  const isCenterTicket = ticket.centerId === centerId;
  const isCenterStaff =
    session.activeCenterRole === "DIRECTOR" ||
    session.activeCenterRole === "CENTER_ADMIN" ||
    session.activeCenterRole === "CENTER_SUPPORT";

  const canAccessTicket =
    isCreator ||
    (isCenterTicket && isCenterStaff) ||
    tenantCtx.isPlatformStaff;

  if (!canAccessTicket) {
    notFound();
  }

  return (
    <CenterTicketChat
      ticket={{
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        scope: ticket.scope,
        createdAt: ticket.createdAt.toISOString(),
        creator: ticket.creator,
        messages: ticket.messages.map((m) => ({
          id: m.id,
          senderUserId: m.senderUserId,
          message: m.message,
          createdAt: m.createdAt.toISOString(),
          sender: m.sender,
        })),
      }}
      currentUserId={session.user.id}
      locale={session.user.preferredLanguage}
    />
  );
}
