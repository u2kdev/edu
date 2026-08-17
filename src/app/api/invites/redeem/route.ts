import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, signJWT } from "@/lib/auth";
import { logAuditEvent } from "@/lib/tenant";
import { checkSubscriptionLimit } from "@/lib/limits";
import crypto from "crypto";

/**
 * POST /api/invites/redeem — Public endpoint for redeeming an invite code.
 * 
 * Two flows:
 * 1. New user: provides code + email + fullName + password → creates User + Membership + Enrollment
 * 2. Existing user (authenticated): provides code → creates Membership + Enrollment
 * 
 * This is the main entry point for students joining a center via invite link/code.
 */
export async function POST(req: Request) {
  try {
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

    if (!invite || invite.isRevoked) {
      return NextResponse.json(
        { error: "Invalid or revoked invite code" },
        { status: 404 }
      );
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return NextResponse.json(
        { error: "Invite code has expired" },
        { status: 400 }
      );
    }

    if (invite.usesCount >= invite.maxUses) {
      return NextResponse.json(
        { error: "Invite code usage limit reached" },
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

    // Check if user already has this role in this center
    let membership = await db.centerMembership.findFirst({
      where: {
        userId: user.id,
        centerId: invite.centerId,
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

      membership = await db.centerMembership.create({
        data: {
          userId: user.id,
          centerId: invite.centerId,
          role: invite.targetRole,
          status: "ACTIVE",
        },
      });
    } else if (membership.status !== "ACTIVE") {
      // Re-activate if previously deactivated
      membership = await db.centerMembership.update({
        where: { id: membership.id },
        data: { status: "ACTIVE" },
      });
    }

    // If invite is linked to a group, verify capacity and enroll student
    if (invite.groupId && invite.targetRole === "STUDENT") {
      const group = await db.group.findUnique({
        where: { id: invite.groupId },
        include: { _count: { select: { enrollments: true } } },
      });

      if (group) {
        const currentCount = group._count.enrollments;
        const existingEnrollment = await db.enrollment.findFirst({
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

          await db.enrollment.create({
            data: {
              studentMembershipId: membership.id,
              groupId: invite.groupId,
              status: "ACTIVE",
            },
          });
        }
      }
    }

    // Increment invite usage
    await db.inviteCode.update({
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
