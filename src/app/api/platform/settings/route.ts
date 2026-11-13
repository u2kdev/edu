import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { getAllPlatformSettings, setPlatformSetting } from "@/lib/platform-settings";
import { z } from "zod";

const updateSettingsSchema = z.record(z.string(), z.any());

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.settings.read", req);
    const settings = await getAllPlatformSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requirePlatformPermission("platform.settings.manage", req);
    const body = await req.json();
    const rawUpdates = body.settings && typeof body.settings === "object" ? body.settings : body;
    const parsed = updateSettingsSchema.safeParse(rawUpdates);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid settings format" }, { status: 400 });
    }

    const updates = parsed.data;
    const updatedKeys: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      await setPlatformSetting(key, value, session.user.id);
      updatedKeys.push(key);
    }

    await db.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "PLATFORM_SETTINGS_UPDATED",
        resource: "PlatformSetting",
        detailsJson: JSON.stringify({ keys: updatedKeys }),
      },
    });

    const refreshed = await getAllPlatformSettings();
    return NextResponse.json({ success: true, settings: refreshed });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
