import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
// Reason: Exception: File handler verifies membership across tenant and platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { safeResolvePath, getStorageDir, getLegacyStorageDir } from "@/lib/storage";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

export async function GET(
  req: Request,
  { params }: { params: { path?: string[] } }
) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pathSegments = params.path;
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const relativePath = pathSegments.join("/");
    if (relativePath.includes("..")) {
      return NextResponse.json({ error: "Forbidden: Invalid file path" }, { status: 403 });
    }

    // Structure: centerId / category / fileName
    const centerId = pathSegments[0];

    const isPlatformStaff = [
      "SUPERADMIN",
      "DEVELOPER",
      "PLATFORM_ADMIN",
      "PLATFORM_SUPPORT",
      "FULL_ACCESS",
    ].includes(session.user.platformRole);

    if (!isPlatformStaff) {
      const membership = await db.centerMembership.findFirst({
        where: {
          centerId,
          userId: session.user.id,
          status: "ACTIVE",
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: Access denied to center files" },
          { status: 403 }
        );
      }
    }

    // Safely resolve in primary or legacy directory
    let safePath = safeResolvePath(getStorageDir(), relativePath);
    let exists = safePath ? fsSync.existsSync(safePath) : false;

    if (!exists) {
      const legacyPath = safeResolvePath(getLegacyStorageDir(), relativePath);
      if (legacyPath && fsSync.existsSync(legacyPath)) {
        safePath = legacyPath;
        exists = true;
      }
    }

    if (!safePath || !exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = await fs.readFile(safePath);
    const fileName = path.basename(safePath);
    const ext = path.extname(safePath).toLowerCase().replace(".", "");

    let contentType = "application/octet-stream";
    if (ext === "png") contentType = "image/png";
    else if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
    else if (ext === "gif") contentType = "image/gif";
    else if (ext === "webp") contentType = "image/webp";
    else if (ext === "pdf") contentType = "application/pdf";
    else if (ext === "mp4") contentType = "video/mp4";
    else if (ext === "mp3") contentType = "audio/mpeg";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[GET /api/files]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
