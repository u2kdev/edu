import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { handlePlatformError } from "@/lib/platformAuth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAuthSession(req);
    if (!session || session.user.platformRole !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden: Superadmin only" }, { status: 403 });
    }

    const center = await db.learningCenter.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        subscriptions: { include: { plan: true } },
        platformPayments: true,
        memberships: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } },
          },
        },
        courses: true,
        branches: true,
        subjects: true,
        accounts: true,
        financeCategories: true,
        financeTransactions: { take: 1000 },
        supportTickets: { include: { messages: true } },
        auditLogs: { take: 500, orderBy: { createdAt: "desc" } },
      },
    });

    if (!center) {
      return NextResponse.json({ error: "Center not found" }, { status: 404 });
    }

    const payload = {
      exportVersion: "1.0",
      exportedAt: new Date().toISOString(),
      exportMetadata: {
        exportedBy: session.user.email,
        exportedAt: new Date().toISOString(),
      },
      exportedBy: {
        id: session.user.id,
        email: session.user.email,
        fullName: session.user.fullName,
      },
      center,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const filename = `center-backup-${center.slug}-${new Date().toISOString().slice(0, 10)}.json`;

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
