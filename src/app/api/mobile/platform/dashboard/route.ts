// Reason: Platform mobile dashboard operates across all tenants for Platform Staff.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { NextResponse } from "next/server";

const ALLOWED_PLATFORM_ROLES = new Set([
  "SUPERADMIN",
  "PLATFORM_ADMIN",
  "DEVELOPER",
  "FULL_ACCESS",
  "PLATFORM_SUPPORT",
]);

export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.platformRole;
    if (!ALLOWED_PLATFORM_ROLES.has(role)) {
      return NextResponse.json(
        { error: "Forbidden: Platform staff privileges required" },
        { status: 403 }
      );
    }

    const [
      totalCenters,
      activeCenters,
      totalUsers,
      totalStudents,
      openTicketsCount,
      centersList,
    ] = await Promise.all([
      db.learningCenter.count(),
      db.learningCenter.count({ where: { status: "ACTIVE" } }),
      db.platformUser.count({ where: { isActive: true } }),
      db.centerMembership.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
      db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      db.learningCenter.findMany({
        include: {
          owner: { select: { fullName: true, email: true } },
          _count: {
            select: {
              memberships: true,
              courses: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);

    return NextResponse.json({
      success: true,
      admin: {
        id: session.user.id,
        fullName: session.user.fullName,
        email: session.user.email,
        platformRole: role,
      },
      kpis: {
        totalCenters,
        activeCenters,
        totalUsers,
        totalStudents,
        openTicketsCount,
      },
      centers: centersList.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        status: c.status,
        ownerName: c.owner.fullName,
        membersCount: c._count.memberships,
        coursesCount: c._count.courses,
      })),
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Failed to load platform dashboard" },
      { status: error.status || 500 }
    );
  }
}
