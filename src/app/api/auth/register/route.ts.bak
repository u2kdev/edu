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
    if (!checkRateLimit(ip + "_register", 5, 60 * 60 * 1000)) {
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
      include: { center: { select: { name: true } } },
    });

    const genericInvalidError = apiError("Invalid, expired, or exhausted invite code", "INVALID_INVITE", 400);

    if (!invite) return genericInvalidError;
    if (invite.expiresAt && invite.expiresAt < new Date()) return genericInvalidError;
    if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) return genericInvalidError;
    
    // 2. Roles check
    const allowedRoles = ["CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "CENTER_SUPPORT", "STUDENT", "PARENT"];
    if (!allowedRoles.includes(invite.targetRole)) {
      return genericInvalidError;
    }

    // 3. Check existing user
    let user = await db.platformUser.findUnique({ where: { email } });
    
    if (user) {
      // Existing user: Do not change password. Create PendingInvite.
      // Balance timing with bcrypt hash
      await hashPassword(password);

      const pendingCount = await db.pendingInvite.count({
        where: { email, inviteCode: { centerId: invite.centerId }, status: "PENDING" }
      });
      if (pendingCount >= 10) {
        return apiError("Too many pending invites for this center", "RATE_LIMITED", 429);
      }
      
      const ip = req.headers.get("x-forwarded-for") || "unknown";
      const pendingCountIp = await db.pendingInvite.count({
        where: { ipAddress: ip, status: "PENDING", createdAt: { gte: new Date(Date.now() - 3600000) } }
      });
      if (pendingCountIp >= 20) {
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
      void sendEmail(user!.email, "Invited", "Please check").catch(err => {
        db.auditLog.create({
          data: {
            action: "EMAIL_FAILED",
            resource: "PlatformUser",
            detailsJson: JSON.stringify({ error: err.message, email })
          }
        }).catch(() => {});
      });

      return apiSuccess({ message: "Registration successful. Please check your email to confirm." });
    }

    // 4. Atomic increment of invite uses for NEW user
    const updateCount = await db.inviteCode.updateMany({
      where: { id: invite.id, usesCount: invite.usesCount },
      data: { usesCount: { increment: 1 } },
    });

    if (updateCount.count === 0) {
      return genericInvalidError;
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

    new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (process.env.TEST_EMAIL_FAIL === "true") {
          reject(new Error("Simulated email driver failure"));
          return;
        }
        if (process.env.NODE_ENV !== "production") {
          console.log(`\n=== DEV EMAIL DRIVER ===`);
          console.log(`To: ${user.email}`);
          console.log(`Subject: Confirm your email (LMS)`);
          console.log(`Link: http://localhost:3000/confirm-email?token=${confirmToken}`);
          console.log(`========================\n`);
        }
        resolve();
      }, 0);
    }).catch(err => {
      db.auditLog.create({
        data: {
          action: "EMAIL_FAILED",
          resource: "PlatformUser",
          detailsJson: JSON.stringify({ error: err.message, email: user.email })
        }
      }).catch(() => {});
    });

    return apiSuccess({ message: "Registration successful. Please check your email to confirm." });
  } catch (err: any) {
    return handleApiError(err);
  }
}
