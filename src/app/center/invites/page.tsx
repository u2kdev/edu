import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import InvitesManager from "@/components/InvitesManager";

export default async function CenterInvitesPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const invites = await db.inviteCode.findMany({
    where: { centerId },
    include: {
      course: { select: { title: true } },
      group: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const courses = await db.course.findMany({
    where: { centerId },
    select: { id: true, title: true },
  });

  const groups = await db.group.findMany({
    where: { course: { centerId } },
    select: { id: true, name: true },
  });

  return (
    <InvitesManager
      initialInvites={invites}
      courses={courses}
      groups={groups}
      role={session.activeCenterRole || ""}
    />
  );
}
