import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { getPlatformSetting, setPlatformSetting, type PlatformSeoSetting } from "@/lib/platform-settings";
import { z } from "zod";

const seoSchema = z.object({
  metaTitleRu: z.string().min(2).max(200),
  metaDescRu: z.string().min(5).max(500),
  ogImageUrl: z.string().url().or(z.string().min(5)),
  keywords: z.string().min(2).max(500),
});

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.settings.read", req);
    const seo = await getPlatformSetting("platform.seo");
    return NextResponse.json({ success: true, seo });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requirePlatformPermission("platform.settings.manage", req);
    const body = await req.json();
    const parsed = seoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const data: PlatformSeoSetting = parsed.data;
    await setPlatformSetting("platform.seo", data, session.user.id, "SEO metadata");

    await db.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "PLATFORM_SEO_UPDATED",
        resource: "PlatformSetting",
        detailsJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({ success: true, seo: data });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
