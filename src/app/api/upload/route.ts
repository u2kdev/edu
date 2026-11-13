import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  saveFile,
  StorageCategory,
  StorageValidationError,
} from "@/lib/storage";

const VALID_CATEGORIES: StorageCategory[] = ["MATERIAL", "HOMEWORK", "AVATAR"];

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session } = tenantCtx;

    const formData = await req.formData();
    const file = formData.get("file");
    const categoryRaw = (formData.get("category") as string | null) || "MATERIAL";
    const category = VALID_CATEGORIES.includes(categoryRaw as StorageCategory)
      ? (categoryRaw as StorageCategory)
      : "MATERIAL";

    // Permission checks based on upload category:
    // - AVATAR: any active center member can upload their profile avatar
    // - HOMEWORK: STUDENT (for homework submission), TEACHER, TEACHER_ASSISTANT, or staff
    // - MATERIAL: requires materials.upload / materials.manage / TEACHER / TEACHER_ASSISTANT
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

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Файл не найден в запросе" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const saved = await saveFile({
      centerId: center.id,
      category,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      buffer,
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "UPLOAD_FILE",
      resource: "Storage",
      resourceId: saved.key,
      details: {
        category,
        fileName: saved.fileName,
        sizeBytes: saved.sizeBytes,
        fileUrl: saved.fileUrl,
      },
    });

    return NextResponse.json({
      success: true,
      fileUrl: saved.fileUrl,
      key: saved.key,
      fileName: saved.fileName,
      originalName: file.name,
      sizeBytes: saved.sizeBytes,
      mimeType: file.type || "application/octet-stream",
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof StorageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[POST /api/upload]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
