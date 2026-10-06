import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.read", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const center = await db.learningCenter.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, email: true, fullName: true } }
      }
    });

    if (!center) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const membersGrouped = await db.centerMembership.groupBy({
      by: ["role"],
      where: { centerId: params.id },
      _count: { id: true }
    });

    const metrics = {
      usersByRole: membersGrouped.reduce((acc, curr) => {
        acc[curr.role] = curr._count.id;
        return acc;
      }, {} as Record<string, number>)
    };

    const auditLogs = await db.auditLog.findMany({
      where: { centerId: params.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ data: center, director: center.owner, metrics, auditLogs });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  timeZone: z.string().optional(),
  brandingConfig: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession();
    if (!session || !hasPermission("platform.centers.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsedBody = patchSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const existing = await db.learningCenter.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await db.learningCenter.update({
      where: { id: params.id },
      data: parsedBody.data,
    });

    const before = {
      name: existing.name,
      phone: existing.phone,
      email: existing.email,
      timeZone: existing.timeZone,
      brandingConfig: existing.brandingConfig
    };
    const after = {
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      timeZone: updated.timeZone,
      brandingConfig: updated.brandingConfig
    };

    await db.auditLog.create({
      data: {
        centerId: params.id,
        actorUserId: session.user.id,
        action: "PLATFORM_UPDATE_LEARNING_CENTER",
        resource: "LearningCenter",
        detailsJson: JSON.stringify({ before, after }),
      },
    });

    return NextResponse.json({ success: true, center: updated });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
