import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import crypto from "crypto";

const schema = z.object({
  email: z.string().email()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const ip = getClientIp(req);
    if (!checkRateLimit(ip, 5, 60000)) return NextResponse.json({error: 'Too many requests'}, {status: 429});
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const targetEmail = parsed.data.email.toLowerCase().trim();

    const center = await db.learningCenter.findUnique({
      where: { id: params.id }
    });
    if (!center) {
      return NextResponse.json({ error: "Center not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      let user = await tx.platformUser.findUnique({ where: { email: targetEmail } });
      if (!user) {
        user = await tx.platformUser.create({
          data: {
            email: targetEmail,
            fullName: "New Director",
            passwordHash: crypto.randomBytes(16).toString("hex"),
            emailVerified: new Date()
          }
        });
      }

      const oldOwnerId = center.ownerId;
      
      if (oldOwnerId !== user.id) {
        await tx.centerMembership.updateMany({
          where: { centerId: params.id, userId: oldOwnerId, role: "DIRECTOR" },
          data: { role: "CENTER_ADMIN" }
        });
      }

      const existingMembership = await tx.centerMembership.findUnique({
        where: { userId_centerId_role: { userId: user.id, centerId: params.id, role: "DIRECTOR" } }
      });
      
      if (!existingMembership) {
        const otherMembership = await tx.centerMembership.findFirst({
            where: { userId: user.id, centerId: params.id }
        });

        if (otherMembership) {
            await tx.centerMembership.update({
                where: { id: otherMembership.id },
                data: { role: "DIRECTOR" }
            });
        } else {
            await tx.centerMembership.create({
            data: { userId: user.id, centerId: params.id, role: "DIRECTOR" }
            });
        }
      }

      await tx.learningCenter.update({
        where: { id: params.id },
        data: { ownerId: user.id }
      });

      await tx.auditLog.create({
        data: {
          centerId: params.id,
          actorUserId: session.user.id,
          action: "PLATFORM_CHANGE_DIRECTOR",
          resource: "LearningCenter",
          detailsJson: JSON.stringify({ oldOwnerId, newOwnerId: user.id })
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
