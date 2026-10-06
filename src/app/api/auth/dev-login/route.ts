import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signJWT, hashJti, JWTPayload } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

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
    const jti = uuidv4();
    const expiresIn = "30d";
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const payload = {
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      jti,
    } as JWTPayload;

    const token = signJWT(payload, expiresIn);

    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";

    // Create session in DB
    await db.userSession.create({
      data: {
        userId: user.id,
        jtiHash: hashJti(jti),
        expiresAt,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") || "DevLogin",
        lastSeenAt: new Date(),
      }
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
