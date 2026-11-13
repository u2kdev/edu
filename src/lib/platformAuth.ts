import { getAuthSession } from "./auth";
import { hasPermission, Permission } from "./permissions";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function requirePlatformPermission(permission: Permission, req?: Request) {
  const session = await getAuthSession(req);
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (!hasPermission(permission, session.user.platformRole)) {
    throw new Error(`Forbidden: ${permission} required`);
  }

  return session;
}

export async function requirePlatformOwner(req?: Request) {
  const session = await getAuthSession(req);
  if (!session) {
    throw new Error("Unauthorized");
  }

  const role = session.user.platformRole;
  const isPlatformOwner =
    role === "PLATFORM_ADMIN" ||
    role === "SUPERADMIN" ||
    role === "DEVELOPER" ||
    role === "FULL_ACCESS";

  if (!isPlatformOwner) {
    throw new Error("Forbidden: Platform Owner privileges required");
  }

  return session;
}

export async function requireDeveloper(req?: Request) {
  const session = await getAuthSession(req);
  if (!session) {
    throw new Error("Unauthorized");
  }

  const role = session.user.platformRole;
  const isDeveloper = role === "DEVELOPER";

  if (!isDeveloper) {
    throw new Error("Forbidden: Developer privileges required");
  }

  return session;
}

export function handlePlatformError(err: unknown) {
  if (err instanceof z.ZodError) {
    const firstIssue = err.issues?.[0];
    return NextResponse.json(
      {
        success: false,
        error: firstIssue?.message || "Ошибка валидации данных",
        details: err.issues,
      },
      { status: 400 }
    );
  }

  const errorObj = err as { message?: string } | null | undefined;
  const msg = errorObj?.message || "";
  if (msg === "Unauthorized") {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (msg.startsWith("Forbidden")) {
    return NextResponse.json({ success: false, error: msg }, { status: 403 });
  }
  // Unexpected error: log details server-side, never leak them to the client.
  console.error("Unhandled platform API error:", err);
  return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
}
