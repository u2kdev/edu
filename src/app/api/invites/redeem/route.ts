import { NextResponse } from "next/server";
// Reason: Exception: Invite validation requires global search before center context is known.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { hashPassword, signJWT } from "@/lib/auth";
import { getTenantDb } from "@/lib/db-tenant";
import { logAuditEvent } from "@/lib/tenant";
import { checkSubscriptionLimit } from "@/lib/limits";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, handleApiError } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    const { code, email, fullName, phone, password } = await req.json();

    if (!code) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      );
    }

    const cleanCode = code.toUpperCase().trim();

    // Validate the invite code
    const invite = await db.inviteCode.findUnique({
      where: { code: cleanCode },
      include: {
        center: true,
        course: { select: { id: true, title: true } },
        group: { select: { id: true, name: true } },
      },
    });

    if (
      !invite || 
      invite.isRevoked || 
      (invite.expiresAt && new Date() > invite.expiresAt) || 
      (invite.usesCount >= invite.maxUses)
    ) {
      // Neutral message to prevent leaking if code exists
      return NextResponse.json(
        { error: "Недействительный инвайт-код" },
        { status: 400 }
      );
    }

    // Check center status
    if (invite.center.status === "BLOCKED") {
      return NextResponse.json(
        { error: "This learning center has been suspended" },
        { status: 403 }
      );
    }

    // Determine user: find existing or create new
    let user;
    let isNewUser = false;

    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      user = await db.platformUser.findUnique({
        where: { email: cleanEmail },
      });

      if (!user) {
        // New user registration via invite
        if (!fullName || !password) {
          return NextResponse.json(
            { error: "Full name and password are required for new users" },
            { status: 400 }
          );
        }

        if (password.length < 6) {
          return NextResponse.json(
            { error: "Password must be at least 6 characters" },
            { status: 400 }
          );
        }

        const passwordHash = await hashPassword(password);

        user = await db.platformUser.create({
          data: {
            email: cleanEmail,
            fullName,
            phone: phone || null,
            passwordHash,
            preferredLanguage: invite.center.defaultLanguage || "ru",
          },
        });

        isNewUser = true;
      }
    } else {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const tenantDb = getTenantDb(invite.centerId);
    let membership = await tenantDb.centerMembership.findFirst({
      where: {
        userId: user.id,
        role: invite.targetRole,
      },
    });

    if (!membership) {
      if (invite.targetRole === "STUDENT") {
        const canAddStudent = await checkSubscriptionLimit(invite.centerId, "students");
        if (!canAddStudent) {
          return NextResponse.json({ error: "PLAN_LIMIT_REACHED: Center has reached its maximum student limit." }, { status: 403 });
        }
      } else if (invite.targetRole === "TEACHER" || invite.targetRole === "TEACHER_ASSISTANT") {
        const canAddTeacher = await checkSubscriptionLimit(invite.centerId, "teachers");
        if (!canAddTeacher) {
          return NextResponse.json({ error: "PLAN_LIMIT_REACHED: Center has reached its maximum teacher limit." }, { status: 403 });
        }
      }

      membership = await tenantDb.centerMembership.create({
        data: {
          centerId: invite.centerId,
          userId: user.id,
          role: invite.targetRole,
          status: "ACTIVE",
        },
      });
    } else if (membership.status !== "ACTIVE") {
      // Re-activate if previously deactivated
      await tenantDb.centerMembership.updateMany({
        where: { id: membership.id },
        data: { status: "ACTIVE" },
      });
      membership = await tenantDb.centerMembership.findFirst({
        where: { id: membership.id }
      });
    }

    // If invite is linked to a group, verify capacity and enroll student
    if (invite.groupId && invite.targetRole === "STUDENT" && membership) {
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
              { error: `Group "${group.name}" is full (capacity: ${group.maxStudents} students).` },
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
      data: { usesCount: invite.usesCount + 1 },
    });

    // Audit log
    await logAuditEvent({
      centerId: invite.centerId,
      actorUserId: user.id,
      action: "INVITE_REDEEMED",
      resource: "InviteCode",
      resourceId: invite.id,
      details: {
        code: cleanCode,
        role: invite.targetRole,
        isNewUser,
        groupId: invite.groupId,
      },
    });

    // Sign JWT for the new/existing user and set cookie
    const token = signJWT({
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      activeCenterId: invite.centerId,
      activeCenterRole: invite.targetRole,
    });

    const response = NextResponse.json({
      success: true,
      isNewUser,
      center: {
        id: invite.center.id,
        name: invite.center.name,
        slug: invite.center.slug,
      },
      role: invite.targetRole,
      groupName: invite.group?.name || null,
      courseName: invite.course?.title || null,
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
    console.error("Invite redeem error:", err);
    return NextResponse.json(
      { error: err.message || "Error redeeming invite" },
      { status: 500 }
    );
  }
}
