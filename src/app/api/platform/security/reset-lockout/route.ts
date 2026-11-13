import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { z } from "zod";

const resetLockoutSchema = z.object({
  id: z.string().optional(),
  email: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requirePlatformPermission("platform.security", req);
    const body = await req.json();
    const parsed = resetLockoutSchema.safeParse(body);

    if (!parsed.success || (!parsed.data.id && !parsed.data.email)) {
      return NextResponse.json({ error: "id or email is required" }, { status: 400 });
    }

    const { id, email } = parsed.data;

    if (id) {
      await db.loginAttempt.delete({ where: { id } }).catch(() => {});
    } else if (email) {
      await db.loginAttempt.deleteMany({ where: { email } });
    }

    await db.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "PLATFORM_LOGIN_LOCKOUT_RESET",
        resource: "LoginAttempt",
        detailsJson: JSON.stringify({ id, email }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
