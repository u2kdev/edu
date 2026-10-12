import { NextResponse } from "next/server";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { isValidLocale } from "@/i18n";

// PATCH /api/auth/me/language — Update user's preferred language
export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { language } = await req.json();

    if (!language || !isValidLocale(language)) {
      return NextResponse.json(
        { error: "Invalid language. Supported: ru, uz-Latn" },
        { status: 400 }
      );
    }

    const updatedUser = await db.platformUser.update({
      where: { id: session.user.id },
      data: { preferredLanguage: language },
      select: {
        id: true,
        preferredLanguage: true,
      },
    });

    return NextResponse.json({
      success: true,
      preferredLanguage: updatedUser.preferredLanguage,
    });
  } catch (err: unknown) {
    console.error("Language update error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
