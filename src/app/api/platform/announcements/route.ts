import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformOwner, handlePlatformError } from "@/lib/platformAuth";
import { logAuditEvent } from "@/lib/tenant";

export async function GET() {
  try {
    await requirePlatformOwner();
    const announcements = await db.announcement.findMany({
      where: { centerId: "PLATFORM" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ announcements });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requirePlatformOwner();
    const { title, body, priority, targetRole } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: "Title and body required" }, { status: 400 });
    }

    const announcement = await db.announcement.create({
      data: {
        centerId: "PLATFORM", // Special constant for platform-wide announcements
        authorId: session.user.id, // Using user.id directly since it's platform level
        title,
        body,
        groupId: targetRole || null, // Storing targetRole in groupId for platform announcements
      },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_ANNOUNCEMENT_CREATED",
      resource: "Announcement",
      resourceId: announcement.id,
      details: { title },
    });

    return NextResponse.json({ success: true, announcement });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}
