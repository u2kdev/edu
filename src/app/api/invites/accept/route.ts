import { NextResponse } from "next/server";
// Reason: Exception: Invite validation requires global search before center context is known.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, signJWT } from "@/lib/auth";
import { getTenantDb } from "@/lib/db-tenant";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, handleApiError } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Для погашения инвайта войдите в аккаунт" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Введите инвайт-код" }, { status: 400 });
    }

    const cleanCode = code.toUpperCase().trim();

    const invite = await db.inviteCode.findUnique({
      where: { code: cleanCode },
      include: {
        center: true,
      },
    });

    if (
      !invite || 
      invite.isRevoked || 
      (invite.expiresAt && new Date() > invite.expiresAt) || 
      (invite.maxUses !== null && invite.usesCount >= invite.maxUses)
    ) {
      // Neutral message to prevent leaking if code exists
      return NextResponse.json({ error: "Недействительный инвайт-код" }, { status: 400 });
    }

    const tenantDb = getTenantDb(invite.centerId);

    // Check if user is already a member with this role
    let membership = await tenantDb.centerMembership.findFirst({
      where: {
        userId: session.user.id,
        role: invite.targetRole,
      },
    });

    if (!membership) {
      membership = await tenantDb.centerMembership.create({
        data: {
          userId: session.user.id,
          centerId: invite.centerId,
          role: invite.targetRole,
        },
      });
    }

    // If invite is linked to a group, verify capacity and enroll student
    if (invite.groupId && invite.targetRole === "STUDENT") {
      const group = await tenantDb.group.findUnique({
        where: { id: invite.groupId },
        include: { _count: { select: { enrollments: true } } },
      });

      if (group) {
        const currentCount = group._count.enrollments;
        const existingEnrollment = await tenantDb.enrollment.findFirst({
          where: {
            studentMembershipId: membership.id,
            groupId: invite.groupId,
          },
        });

        if (!existingEnrollment) {
          if (currentCount >= group.maxStudents) {
            return NextResponse.json(
              { error: `Группа «${group.name}» заполнена (лимит: ${group.maxStudents} учеников).` },
              { status: 400 }
            );
          }

          await tenantDb.enrollment.create({
            data: {
              centerId: invite.centerId,
              studentMembershipId: membership.id,
              groupId: invite.groupId,
              status: "ACTIVE",
            },
          });
        }
      }
    }

    // Increment invite usage
    await tenantDb.inviteCode.updateMany({
      where: { id: invite.id },
      data: {
        usesCount: invite.usesCount + 1,
      },
    });

    // Update active session token to switch to this center
    const token = signJWT({
      userId: session.user.id,
      email: session.user.email,
      platformRole: session.user.platformRole,
      activeCenterId: invite.centerId,
      activeCenterRole: invite.targetRole,
    });

    const response = NextResponse.json({
      success: true,
      center: {
        id: invite.center.id,
        name: invite.center.name,
        slug: invite.center.slug,
      },
      role: invite.targetRole,
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("Accept invite error:", err);
    return NextResponse.json({ error: "Ошибка при активации инвайта" }, { status: 500 });
  }
}
