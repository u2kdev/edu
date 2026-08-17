import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDeveloper, handlePlatformError } from "@/lib/platformAuth";
import { hashPassword } from "@/lib/auth";
import { logAuditEvent } from "@/lib/tenant";

export async function GET() {
  try {
    await requireDeveloper();
    const owners = await db.platformUser.findMany({
      where: {
        platformRole: { in: ["PLATFORM_ADMIN", "SUPERADMIN", "DEVELOPER", "FULL_ACCESS", "PLATFORM_SUPPORT"] },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        platformRole: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ owners });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireDeveloper();
    const { email, fullName, role, password } = await req.json();

    if (!email || !fullName || !role || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const allowedRoles = ["PLATFORM_ADMIN", "PLATFORM_SUPPORT"];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json({ error: `Role must be one of: ${allowedRoles.join(", ")}` }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await db.platformUser.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json({ error: "User already exists with this email" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const user = await db.platformUser.create({
      data: {
        email: cleanEmail,
        fullName,
        platformRole: role,
        passwordHash,
      },
      select: { id: true, email: true, fullName: true, platformRole: true },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "DEVELOPER_CREATED_PLATFORM_OWNER",
      resource: "PlatformUser",
      resourceId: user.id,
      details: { email: user.email, role: user.platformRole },
    });

    return NextResponse.json({ success: true, user });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireDeveloper();
    const { id, isActive, role } = await req.json();

    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });

    const targetUser = await db.platformUser.findUnique({ where: { id } });
    if (!targetUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Prevent demoting developers via this simple endpoint unless you are SUPERADMIN.
    // Assuming the executing user is DEVELOPER/SUPERADMIN.
    if (targetUser.platformRole === "DEVELOPER" && session.user.platformRole !== "DEVELOPER") {
       return NextResponse.json({ error: "Cannot modify a developer" }, { status: 403 });
    }

    const updated = await db.platformUser.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? isActive : targetUser.isActive,
        platformRole: role || targetUser.platformRole,
      },
      select: { id: true, email: true, platformRole: true, isActive: true },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "DEVELOPER_MODIFIED_PLATFORM_OWNER",
      resource: "PlatformUser",
      resourceId: updated.id,
      details: { isActive: updated.isActive, role: updated.platformRole },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}
