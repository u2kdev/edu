import { NextResponse } from "next/server";
import crypto from "crypto";
// Reason: Exception: Invite validation requires global search before center context is known.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, createSessionToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { apiError } from "@/lib/api-response";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const session = await getAuthSession(req);

    const rlKey = session ? `invite-accept:${session.user.id}:${ip}` : `invite-accept:${ip}`;
    if (!(await checkRateLimit(rlKey, 10, 60000))) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    if (!session) {
      return NextResponse.json({ error: "Для погашения инвайта войдите в аккаунт" }, { status: 401 });
    }

    if (session.user.platformRole === "PLATFORM_SUPPORT") {
      return NextResponse.json({ error: "Forbidden: Platform support cannot redeem invites" }, { status: 403 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Введите инвайт-код" }, { status: 400 });
    }

    const cleanCode = code.toUpperCase().trim();
    const codeHash = crypto.createHash("sha256").update(cleanCode).digest("hex");

    const invite = await db.inviteCode.findFirst({
      where: {
        code: { in: [cleanCode, codeHash] },
      },
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

    if (invite.center.status === "BLOCKED" || invite.center.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Учебный центр заблокирован или деактивирован" },
        { status: 403 }
      );
    }

    await db.$transaction(async (tx) => {
      // Atomic conditional increment to prevent TOCTOU race conditions
      const affected = await tx.$executeRaw`
        UPDATE "InviteCode"
        SET "usesCount" = "usesCount" + 1
        WHERE "id" = ${invite.id}
          AND "isRevoked" = false
          AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
          AND ("maxUses" IS NULL OR "usesCount" < "maxUses")
      `;

      if (affected === 0) {
        throw new Error("INVITE_EXHAUSTED_OR_INVALID");
      }

      // Check if user is already a member with this role
      let membership = await tx.centerMembership.findFirst({
        where: {
          centerId: invite.centerId,
          userId: session.user.id,
          role: invite.targetRole,
        },
      });

      if (!membership) {
        membership = await tx.centerMembership.create({
          data: {
            userId: session.user.id,
            centerId: invite.centerId,
            role: invite.targetRole,
          },
        });
      }

      // If invite is linked to a group, verify capacity and enroll student
      if (invite.groupId && invite.targetRole === "STUDENT") {
        const group = await tx.group.findFirst({
          where: { id: invite.groupId, centerId: invite.centerId },
          include: { _count: { select: { enrollments: true } } },
        });

        if (group) {
          const currentCount = group._count.enrollments;
          const existingEnrollment = await tx.enrollment.findFirst({
            where: {
              centerId: invite.centerId,
              studentMembershipId: membership.id,
              groupId: invite.groupId,
            },
          });

          if (!existingEnrollment) {
            if (currentCount >= group.maxStudents) {
              throw new Error(`GROUP_FULL:Группа «${group.name}» заполнена (лимит: ${group.maxStudents} учеников).`);
            }

            await tx.enrollment.create({
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

      // If invite is for PARENT and carries a studentMembershipId, establish confirmed ParentLink
      if (invite.targetRole === "PARENT" && invite.studentMembershipId) {
        const existingLink = await tx.parentLink.findFirst({
          where: {
            parentMembershipId: membership.id,
            studentMembershipId: invite.studentMembershipId,
          },
        });

        if (!existingLink) {
          await tx.parentLink.create({
            data: {
              parentMembershipId: membership.id,
              studentMembershipId: invite.studentMembershipId,
              status: "CONFIRMED",
              initiatedBy: "PARENT",
              inviteCodeUsed: codeHash,
              confirmedAt: new Date(),
            },
          });
        } else if (existingLink.status !== "CONFIRMED") {
          await tx.parentLink.updateMany({
            where: {
              parentMembershipId: membership.id,
              studentMembershipId: invite.studentMembershipId,
            },
            data: {
              status: "CONFIRMED",
              confirmedAt: new Date(),
              inviteCodeUsed: codeHash,
            },
          });
        }
      }
    });

    // Update active session token to switch to this center (persisted, revocable, with jti)
    const token = await createSessionToken(
      {
        userId: session.user.id,
        email: session.user.email,
        platformRole: session.user.platformRole,
        activeCenterId: invite.centerId,
        activeCenterRole: invite.targetRole,
      },
      {
        maxAgeSeconds: 7 * 24 * 60 * 60,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || undefined,
      }
    );

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
  } catch (err: unknown) {
    if (err instanceof Error) {
      if (err.message === "INVITE_EXHAUSTED_OR_INVALID") {
        return NextResponse.json({ error: "Недействительный инвайт-код" }, { status: 400 });
      }
      if (err.message.startsWith("GROUP_FULL:")) {
        return NextResponse.json({ error: err.message.slice("GROUP_FULL:".length) }, { status: 400 });
      }
    }
    console.error("Accept invite error:", err);
    return NextResponse.json({ error: "Ошибка при активации инвайта" }, { status: 500 });
  }
}
