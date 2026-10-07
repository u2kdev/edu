import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["pause", "block", "resume"]),
  reason: z.string().min(5).max(500).optional()
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.block", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { action, reason } = parsed.data;

    if ((action === "pause" || action === "block") && !reason) {
      return NextResponse.json({ error: "Reason required for pause/block" }, { status: 400 });
    }

    const center = await db.learningCenter.findUnique({ where: { id: params.id } });
    if (!center) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let status = center.status;
    if (action === "pause") status = "PAUSED";
    if (action === "block") status = "BLOCKED";
    if (action === "resume") status = "ACTIVE"; 

    await db.learningCenter.update({
      where: { id: params.id },
      data: {
        status,
        suspensionReason: action === "resume" ? null : reason
      }
    });

    await db.auditLog.create({
      data: {
        centerId: params.id,
        actorUserId: session.user.id,
        action: `PLATFORM_${action.toUpperCase()}_CENTER`,
        resource: "LearningCenter",
        detailsJson: JSON.stringify({ reason })
      }
    });

    return NextResponse.json({ success: true, status });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
