import { NextResponse } from "next/server";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAuditEvent } from "@/lib/tenant";
import { z } from "zod";
import crypto from "crypto";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  inviteCode: z.string().min(3),
});

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip + "_register", 5, 60 * 60 * 1000)) { // 5 attempts per hour
      return apiError("Too many registration attempts", "RATE_LIMITED", 429);
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid data", "BAD_REQUEST", 400);
    }
    const { email: rawEmail, password, fullName, phone, inviteCode } = parsed.data;
    const email = rawEmail.toLowerCase().trim();

    // 1. Fetch invite code
    const invite = await db.inviteCode.findUnique({
      where: { code: inviteCode.toUpperCase().trim() },
    });

    const genericInvalidError = apiError("Invalid, expired, or exhausted invite code", "INVALID_INVITE", 400);

    if (!invite) return genericInvalidError;
    if (invite.expiresAt && invite.expiresAt < new Date()) return genericInvalidError;
    if (invite.uses >= invite.maxUses) return genericInvalidError;

    // 2. Atomic increment of invite uses (Optimistic Concurrency Control)
    const updateCount = await db.inviteCode.updateMany({
      where: { id: invite.id, uses: invite.uses },
      data: { uses: { increment: 1 } },
    });

    if (updateCount.count === 0) {
      // Race condition lost
      return genericInvalidError;
    }

    // 3. User logic
    let user = await db.platformUser.findUnique({ where: { email } });
    let createdNewUser = false;
    
    // We create a one-time token
    const confirmToken = crypto.randomBytes(32).toString("hex");
    const confirmTokenHash = crypto.createHash("sha256").update(confirmToken).digest("hex");
    const confirmExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    if (!user) {
      const passwordHash = await hashPassword(password);
      user = await db.platformUser.create({
        data: {
          email,
          passwordHash,
          fullName,
          phone,
          emailConfirmToken: confirmTokenHash,
          emailConfirmExpires: confirmExpires,
        },
      });
      createdNewUser = true;
    } else {
      // If user exists, we do NOT change password or reset emailVerified to avoid breaking their account.
      // We still pretend to send a confirmation link, but the existing user can just log in.
    }

    // 4. Create membership
    // Check if membership already exists
    let membership = await db.centerMembership.findFirst({
      where: { userId: user.id, centerId: invite.centerId },
    });

    if (!membership) {
      membership = await db.centerMembership.create({
        data: {
          userId: user.id,
          centerId: invite.centerId,
          role: invite.targetRole,
          status: "ACTIVE", // Or PENDING depending on rules, but prompt doesn't specify.
        }
      });
    }

    if (invite.groupId) {
      const existingEnrollment = await db.enrollment.findFirst({
        where: { studentMembershipId: membership.id, groupId: invite.groupId },
      });
      if (!existingEnrollment) {
        await db.enrollment.create({
          data: {
            centerId: invite.centerId,
            studentMembershipId: membership.id,
            groupId: invite.groupId,
            status: "ACTIVE"
          }
        });
      }
    }

    await logAuditEvent({
      centerId: invite.centerId,
      actorUserId: user.id,
      action: "REGISTERED_VIA_INVITE",
      resource: "PlatformUser",
      resourceId: user.id,
      details: { inviteCode: invite.code, isNewUser: createdNewUser },
    });

    // 5. Send confirmation email (Dev driver)
    console.log(`\n=== DEV EMAIL DRIVER ===`);
    console.log(`To: ${user.email}`);
    console.log(`Subject: Confirm your email (LMS)`);
    console.log(`Link: http://localhost:3000/confirm-email?token=${confirmToken}`);
    console.log(`========================\n`);

    // Generic success response, does not reveal if email existed or not.
    // We do NOT log them in automatically because they haven't verified the email!
    // Returning 200 OK without a cookie.
    return apiSuccess({ message: "Registration successful. Please check your email to confirm." });
  } catch (err: any) {
    return handleApiError(err);
  }
}
