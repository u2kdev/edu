import { NextResponse } from "next/server";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { hashPassword, signJWT } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password, fullName, phone } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Пожалуйста, заполните все обязательные поля (email, пароль, имя)" },
        { status: 400 }
      );
    }

    const existingUser = await db.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже зарегистрирован" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await db.platformUser.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        fullName,
        phone,
      },
    });

    const token = signJWT({
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        platformRole: user.platformRole,
      },
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("Register Error:", err);
    return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
