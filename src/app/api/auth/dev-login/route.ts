import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signJWT } from "@/lib/auth";

export async function POST(req: Request) {
  // Only allow in development mode or if explicitly enabled
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_LOGINS !== "true") {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const user = await db.platformUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create session token
    const token = await signJWT({
      id: user.id,
      email: user.email,
      platformRole: user.platformRole,
    });

    const response = NextResponse.json({ success: true, user });

    // Set cookie
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Dev login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
