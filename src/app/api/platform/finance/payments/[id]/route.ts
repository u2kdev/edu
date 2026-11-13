import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requirePlatformPermission("platform.billing.read", req);

    const payment = await db.platformPayment.findUnique({
      where: { id: params.id },
      include: {
        center: true,
        plan: true,
        subscription: true,
        recorder: {
          select: { id: true, fullName: true, email: true, platformRole: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ success: false, error: "Платёж не найден" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      payment,
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
