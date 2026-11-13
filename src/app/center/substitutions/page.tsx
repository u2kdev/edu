export const dynamic = "force-dynamic";

import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import SubstitutionsManager from "@/components/substitutions/SubstitutionsManager";

export default async function CenterSubstitutionsPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const tenantDb = tenantCtx.getTenantDb();
  const role = session.activeCenterRole || "";
  const locale = session.user.preferredLanguage || "ru";

  const isPrivileged =
    role === "DIRECTOR" || role === "CENTER_ADMIN" || tenantCtx.isPlatformStaff;

  const currentMembershipId = tenantCtx.membership?.id;

  const where = isPrivileged
    ? { centerId }
    : {
        centerId,
        OR: [
          { requesterMembershipId: currentMembershipId },
          { proposedSubstituteMembershipId: currentMembershipId },
          { substituteTeacherMembershipId: currentMembershipId },
        ],
      };

  const [requests, teachers, myLessons] = await Promise.all([
    tenantDb.substitutionRequest.findMany({
      where,
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            scheduledAt: true,
            durationMinutes: true,
            status: true,
            module: {
              select: {
                id: true,
                title: true,
                course: { select: { id: true, title: true } },
              },
            },
            scheduleSlot: {
              select: {
                id: true,
                dayOfWeek: true,
                startTime: true,
                endTime: true,
                group: { select: { id: true, name: true } },
              },
            },
          },
        },
        requester: {
          select: {
            id: true,
            role: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        proposedSubstitute: {
          select: {
            id: true,
            role: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        substituteTeacher: {
          select: {
            id: true,
            role: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        resolvedBy: {
          select: {
            id: true,
            role: true,
            user: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    tenantDb.centerMembership.findMany({
      where: {
        centerId,
        role: { in: ["TEACHER", "TEACHER_ASSISTANT"] },
        status: "ACTIVE",
      },
      include: { user: { select: { fullName: true, email: true } } },
    }),
    currentMembershipId
      ? tenantDb.lesson.findMany({
          where: {
            centerId,
            status: "ACTIVE",
            OR: [
              { scheduleSlot: { teacherMembershipId: currentMembershipId } },
              {
                module: {
                  course: {
                    groups: {
                      some: {
                        OR: [
                          { teacherMembershipId: currentMembershipId },
                          { assistantMembershipId: currentMembershipId },
                        ],
                      },
                    },
                  },
                },
              },
            ],
          },
          select: {
            id: true,
            title: true,
            scheduledAt: true,
            durationMinutes: true,
          },
          orderBy: { scheduledAt: "asc" },
          take: 30,
        })
      : [],
  ]);

  return (
    <SubstitutionsManager
      initialRequests={JSON.parse(JSON.stringify(requests))}
      teachers={teachers.map((t) => ({
        id: t.id,
        role: t.role,
        fullName: t.user.fullName,
        email: t.user.email,
      }))}
      myLessons={JSON.parse(JSON.stringify(myLessons))}
      role={role}
      currentMembershipId={currentMembershipId || ""}
      locale={locale}
    />
  );
}
