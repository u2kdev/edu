import { NextResponse } from "next/server";
import { getAuthSession, createSessionToken } from "@/lib/auth";
import { getClientIp } from "@/lib/ip";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { centerId } = await req.json();
    if (!centerId) {
      return NextResponse.json({ error: "Center ID is required" }, { status: 400 });
    }

    const targetMembership = session.memberships.find((m) => m.centerId === centerId);
    if (!targetMembership && session.user.platformRole === "NONE") {
      const existingMem = await db.centerMembership.findFirst({
        where: { userId: session.user.id, centerId },
      });
      if (existingMem && existingMem.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Forbidden: Membership is not active", code: "MEMBERSHIP_INACTIVE" },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: "Forbidden: You are not a member of this center" }, { status: 403 });
    }

    const token = await createSessionToken(
      {
        userId: session.user.id,
        email: session.user.email,
        platformRole: session.user.platformRole,
        activeCenterId: centerId,
        activeCenterRole: targetMembership?.role,
      },
      {
        maxAgeSeconds: 7 * 24 * 60 * 60,
        ipAddress: getClientIp(req),
        userAgent: req.headers.get("user-agent") || undefined,
      }
    );

    const response = NextResponse.json({
      success: true,
      activeCenterId: centerId,
      activeCenterRole: targetMembership?.role,
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
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
