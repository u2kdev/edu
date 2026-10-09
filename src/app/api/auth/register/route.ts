import { NextResponse } from "next/server";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { logAuditEvent } from "@/lib/tenant";
import { sendEmail } from "@/lib/email";
import { registerSchema } from "@/lib/validation/auth";
import crypto from "crypto";
import { REGISTER_CONFIG } from "@/lib/config";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    const body = await req.json().catch(() => ({}));
    const rawCode = typeof body.inviteCode === "string" ? body.inviteCode.toUpperCase().trim() : "UNKNOWN";

    if (!checkRateLimit(ip + "_register", REGISTER_CONFIG.IP_HOURLY_LIMIT, 3600000)) {
      return apiError("Too many registration attempts from this IP", "RATE_LIMITED", 429);
    }
    if (!checkRateLimit(rawCode + "_register", REGISTER_CONFIG.CODE_HOURLY_LIMIT, 3600000)) {
      return apiError("Too many registrations for this code", "RATE_LIMITED", 429);
    }
    if (!checkRateLimit(ip + "_" + rawCode + "_register", REGISTER_CONFIG.CODE_IP_HOURLY_LIMIT, 3600000, false)) {
      return apiError("Too many registration attempts for this code from this IP", "RATE_LIMITED", 429);
    }

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      checkRateLimit(ip + "_" + rawCode + "_register", REGISTER_CONFIG.CODE_IP_HOURLY_LIMIT, 3600000, true);
      return apiError("Invalid data", "BAD_REQUEST", 400);
    }
    const { email: rawEmail, password, fullName, phone, inviteCode } = parsed.data;
    const cleanCode = inviteCode.toUpperCase().trim();
    const email = rawEmail.toLowerCase().trim();

    // 1. Fetch invite code
    const invite = await db.inviteCode.findUnique({
      where: { code: inviteCode.toUpperCase().trim() },
      include: { center: { select: { name: true } } },
    });

    const consumeAndReturnInvalidError = () => {
      checkRateLimit(ip + "_" + rawCode + "_register", REGISTER_CONFIG.CODE_IP_HOURLY_LIMIT, 3600000, true);
      return apiError("Invalid, expired, or exhausted invite code", "INVALID_INVITE", 400);
    };

    if (!invite) return consumeAndReturnInvalidError();
    if (invite.expiresAt && invite.expiresAt < new Date()) return consumeAndReturnInvalidError();
    if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) return consumeAndReturnInvalidError();
    
    // 2. Roles check
    const allowedRoles = ["CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "CENTER_SUPPORT", "STUDENT", "PARENT"];
    if (!allowedRoles.includes(invite.targetRole)) {
      return consumeAndReturnInvalidError();
    }

    // 3. Check existing user
    let user = await db.platformUser.findUnique({ where: { email } });
    
    if (user) {
      // Existing user: Do not change password. Create PendingInvite.
      // Balance timing with bcrypt hash
      await hashPassword(password);

      // DoS protection: Limit PendingInvite by (IP, Center) and IP
      if (!checkRateLimit(ip + "_" + invite.centerId + "_pending", 10, 3600000)) {
        return apiError("Too many pending invites for this center", "RATE_LIMITED", 429);
      }
      
      if (!checkRateLimit(ip + "_pending", 20, 3600000)) {
        return apiError("Too many pending invites from this IP", "RATE_LIMITED", 429);
      }

      // Do NOT consume invite usesCount yet.
      await db.pendingInvite.create({
        data: {
          email,
          inviteCodeId: invite.id,
          ipAddress: ip,
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
        }
      });

      // Fire and forget email safely
      void sendEmail(user.email, "Invited", "Please check").catch(err => {
        db.auditLog.create({
          data: {
            action: "EMAIL_FAILED",
            resource: "PlatformUser",
            detailsJson: JSON.stringify({ error: String(err), email })
          }
        }).catch(() => {});
      });

      return apiSuccess({ message: "Registration successful. Please check your email to confirm." });
    }

    // 4. Atomic increment of invite uses for NEW user
    let updateCount;
    if (invite.maxUses !== null) {
      updateCount = await db.inviteCode.updateMany({
        where: { id: invite.id, usesCount: { lt: invite.maxUses } },
        data: { usesCount: { increment: 1 } },
      });
    } else {
      updateCount = await db.inviteCode.updateMany({
        where: { id: invite.id },
        data: { usesCount: { increment: 1 } },
      });
    }

    if (updateCount.count === 0) {
      return consumeAndReturnInvalidError();
    }

    // 5. New User Logic
    const passwordHash = await hashPassword(password);
    const confirmToken = crypto.randomBytes(32).toString("hex");
    const confirmTokenHash = crypto.createHash("sha256").update(confirmToken).digest("hex");
    const confirmExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

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

    // Create membership only for new users
    const membership = await db.centerMembership.create({
      data: {
        userId: user.id,
        centerId: invite.centerId,
        role: invite.targetRole,
        status: "ACTIVE",
      }
    });

    if (invite.groupId) {
      await db.enrollment.create({
        data: {
          centerId: invite.centerId,
          studentMembershipId: membership.id,
          groupId: invite.groupId,
          status: "ACTIVE"
        }
      });
    }

    await logAuditEvent({
      centerId: invite.centerId,
      actorUserId: user.id,
      action: "REGISTERED_VIA_INVITE",
      resource: "PlatformUser",
      resourceId: user.id,
      details: { inviteCode: invite.code, isNewUser: true },
    });

    void sendEmail(user.email, "Confirm", "Please confirm").catch(err => {
      db.auditLog.create({
        data: {
          action: "EMAIL_FAILED",
          resource: "PlatformUser",
          detailsJson: JSON.stringify({ error: String(err), email: user!.email })
        }
      }).catch(() => {});
    });

    return apiSuccess({ message: "Registration successful. Please check your email to confirm." });
  } catch (err: any) {
    return handleApiError(err);
  }
}
