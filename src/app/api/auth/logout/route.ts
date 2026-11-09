import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getClientIp } from "@/lib/ip";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    // Log logout event before clearing cookie
    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";
    const session = await getAuthSession(req);
    if (session) {
      const ip = getClientIp(req);
      try {
        if (all) {
          await db.userSession.updateMany({
            where: { userId: session.user.id, revokedAt: null },
            data: { revokedAt: new Date() }
          });
        } else if (session.sessionId) {
          await db.userSession.update({
            where: { id: session.sessionId },
            data: { revokedAt: new Date() }
          });
        }
        await db.auditLog.create({
          data: {
            centerId: session.activeCenterId || null,
            actorUserId: session.user.id,
            action: "LOGOUT",
            resource: "PlatformUser",
            resourceId: session.user.id,
            detailsJson: JSON.stringify({ email: session.user.email, ip }),
            ipAddress: ip,
          },
        });
      } catch { /* ignore audit log failure on logout */ }
    }
  } catch { /* ignore session errors on logout */ }

  const response = NextResponse.json({ success: true });
  response.cookies.delete("auth_token");
  return response;
}
