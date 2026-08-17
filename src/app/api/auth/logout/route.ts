import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    // Log logout event before clearing cookie
    const session = await getAuthSession();
    if (session) {
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
      try {
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
