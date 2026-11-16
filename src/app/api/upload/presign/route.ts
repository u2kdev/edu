import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { generatePresignedUploadUrl, StorageValidationError, StorageCategory, isUploadsEnabled } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    if (!isUploadsEnabled()) {
      return NextResponse.json(
        { error: "Uploads are disabled (FEATURE_UPLOADS=false)" },
        { status: 403 }
      );
    }

    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session } = tenantCtx;

    const body = (await req.json()) as {
      fileName?: string;
      contentType?: string;
      sizeBytes?: number;
      category?: StorageCategory;
    };

    if (!body.fileName || !body.contentType || !body.sizeBytes || !body.category) {
      return NextResponse.json(
        { error: "fileName, contentType, sizeBytes, and category are required" },
        { status: 400 }
      );
    }

    const category = body.category;
    if (category === "AVATAR") {
      if (!role && !tenantCtx.isPlatformStaff) {
        return NextResponse.json(
          { error: "Forbidden: Active membership required to upload avatar" },
          { status: 403 }
        );
      }
    } else if (category === "HOMEWORK") {
      const canUploadHomework =
        role === "STUDENT" ||
        role === "TEACHER" ||
        role === "TEACHER_ASSISTANT" ||
        hasPermission("assignments.create", session.user.platformRole, role) ||
        hasPermission("assignments.review", session.user.platformRole, role) ||
        hasPermission("materials.upload", session.user.platformRole, role);

      if (!canUploadHomework) {
        return NextResponse.json(
          { error: "Forbidden: Your role cannot upload homework files" },
          { status: 403 }
        );
      }
    } else {
      const canUploadMaterial =
        hasPermission("materials.upload", session.user.platformRole, role) ||
        hasPermission("materials.manage", session.user.platformRole, role) ||
        role === "TEACHER" ||
        role === "TEACHER_ASSISTANT";

      if (!canUploadMaterial) {
        return NextResponse.json(
          { error: "Forbidden: You do not have permission to upload materials" },
          { status: 403 }
        );
      }
    }

    const presigned = await generatePresignedUploadUrl({
      centerId: center.id,
      category: body.category,
      fileName: body.fileName,
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
    });

    return NextResponse.json(presigned);
  } catch (err: unknown) {
    if (err instanceof StorageValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Failed to generate presigned upload URL" },
      { status: error.status || 500 }
    );
  }
}
