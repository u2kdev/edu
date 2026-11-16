import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError } from "@/lib/tenant";
import { assertMaterialAccess } from "@/lib/tenant-access";
import { safeResolvePath, getStorageDir, getLegacyStorageDir } from "@/lib/storage";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { id } = params;

    const material = await assertMaterialAccess(tenantCtx, id);

    if (tenantCtx.membership?.id) {
      await tenantCtx.getTenantDb().activityLog.create({
        data: {
          centerId: tenantCtx.center.id,
          userMembershipId: tenantCtx.membership.id,
          activityType: "VIEW_MATERIAL",
          resourceType: "Material",
          resourceId: material.id,
        },
      });
    }

    const targetUrl = material.fileUrl || material.externalUrl;

    const { searchParams } = new URL(req.url);
    if (
      searchParams.get("format") === "json" ||
      req.headers.get("accept")?.includes("application/json")
    ) {
      return NextResponse.json({
        material,
        fileUrl: targetUrl,
      });
    }

    if (!targetUrl) {
      return NextResponse.json(
        { error: "Material has no downloadable file or URL" },
        { status: 404 }
      );
    }

    if (targetUrl.startsWith("/uploads/") || targetUrl.startsWith("/api/files/")) {
      // Reject Path Traversal attempts
      if (targetUrl.includes("..")) {
        return NextResponse.json(
          { error: "Forbidden: Invalid file path" },
          { status: 403 }
        );
      }

      const relativePart = targetUrl.replace(/^\/(uploads|api\/files)\//, "");

      let safePath = safeResolvePath(getStorageDir(), relativePart);
      let fileExists = safePath ? fsSync.existsSync(safePath) : false;

      if (!fileExists) {
        const legacyPath = safeResolvePath(getLegacyStorageDir(), relativePart);
        if (legacyPath && fsSync.existsSync(legacyPath)) {
          safePath = legacyPath;
          fileExists = true;
        }
      }

      if (!safePath || !fileExists) {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 }
        );
      }

      try {
        const buffer = await fs.readFile(safePath);
        const fileName = path.basename(safePath);
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
            "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch {
        return NextResponse.json(
          { error: "File not found" },
          { status: 404 }
        );
      }
    }

    // Validate external URL
    try {
      const parsedUrl = new URL(targetUrl, req.url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return NextResponse.json(
          { error: "Forbidden: Invalid external URL protocol" },
          { status: 403 }
        );
      }
      return NextResponse.redirect(parsedUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[GET /api/materials/[id]/download]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
