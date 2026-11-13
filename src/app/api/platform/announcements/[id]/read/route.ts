import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(req);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const announcement = await db.platformAnnouncement.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    await db.platformAnnouncementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: id,
          userId: session.user.id,
        },
      },
      update: {
        readAt: new Date(),
      },
      create: {
        announcementId: id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("POST /api/platform/announcements/[id]/read error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
