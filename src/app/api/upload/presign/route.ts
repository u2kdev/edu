import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { generatePresignedUploadUrl, StorageValidationError, StorageCategory } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);

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

    const presigned = await generatePresignedUploadUrl({
      centerId: tenantCtx.center.id,
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
      { error: error.message || "Failed to generate presigned upload URL" },
      { status: error.status || 500 }
    );
  }
}
