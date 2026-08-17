import { NextResponse } from "next/server";
import { getAuthSession, signJWT } from "@/lib/auth";

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
      return NextResponse.json({ error: "Forbidden: You are not a member of this center" }, { status: 403 });
    }

    const token = signJWT({
      userId: session.user.id,
      email: session.user.email,
      platformRole: session.user.platformRole,
      activeCenterId: centerId,
      activeCenterRole: targetMembership?.role,
    });

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
  } catch (err: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
