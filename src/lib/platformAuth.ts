import { getAuthSession } from "./auth";
import { NextResponse } from "next/server";

export async function requirePlatformOwner() {
  const session = await getAuthSession();
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

export async function requireDeveloper() {
  const session = await getAuthSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const role = session.user.platformRole;
  const isDeveloper = role === "DEVELOPER" || role === "SUPERADMIN";

  if (!isDeveloper) {
    throw new Error("Forbidden: Developer privileges required");
  }

  return session;
}

export function handlePlatformError(err: any) {
  if (err.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (err.message.startsWith("Forbidden")) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
}
