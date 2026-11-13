import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError } from "@/lib/tenant";
import { assertMaterialAccess } from "@/lib/tenant-access";
import fs from "fs/promises";
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

    if (targetUrl.startsWith("/uploads/")) {
      const normalizedRelative = targetUrl.replace(/^\/+/, "");
      const absoluteFilePath = path.join(
        process.cwd(),
        "public",
        normalizedRelative
      );
      try {
        const buffer = await fs.readFile(absoluteFilePath);
        const fileName = path.basename(absoluteFilePath);
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
            "Cache-Control": "private, no-store",
          },
        });
      } catch {
        // Fallback to redirect
      }
    }

    return NextResponse.redirect(new URL(targetUrl, req.url));
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
