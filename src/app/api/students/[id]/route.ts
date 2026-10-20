import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const studentMembershipId = params.id;
    const currentRole = tenantCtx.role;

    // Verify student exists in this learning center
    const studentMembership = await tenantDb.centerMembership.findFirst({
      where: {
        id: studentMembershipId,
        centerId: tenantCtx.center.id,
        role: "STUDENT",
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        enrollments: {
          include: {
            group: {
              include: {
                course: { select: { id: true, title: true } },
                teacher: {
                  include: {
                    user: { select: { fullName: true, email: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        parentLinksAsStudent: {
          where: { status: "CONFIRMED" },
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paymentMethod: true,
            createdAt: true,
            paidAt: true,
          },
        },
      },
    });

    if (!studentMembership) {
      return NextResponse.json(
        { error: "Student not found in this learning center" },
        { status: 404 }
      );
    }

    // Role-based security checks:
    // 1. STUDENT role can ONLY view their own card
    if (currentRole === "STUDENT") {
      if (tenantCtx.membership?.id !== studentMembershipId) {
        return NextResponse.json(
          { error: "Forbidden: You can only view your own profile" },
          { status: 403 }
        );
      }
    }

    // 2. PARENT role can ONLY view their confirmed linked children
    if (currentRole === "PARENT") {
      const parentLink = await tenantDb.parentLink.findFirst({
        where: {
          parentMembershipId: tenantCtx.membership?.id,
          studentMembershipId: studentMembershipId,
          status: "CONFIRMED",
        },
      });

      if (!parentLink && !tenantCtx.isPlatformStaff) {
        return NextResponse.json(
          { error: "Forbidden: You can only view linked children" },
          { status: 403 }
        );
      }
    }

    // 3. TEACHER role can ONLY view students enrolled in groups assigned to this teacher
    if (currentRole === "TEACHER") {
      const teacherEnrolled = await tenantDb.enrollment.findFirst({
        where: {
          studentMembershipId: studentMembershipId,
          group: { teacherMembershipId: tenantCtx.membership?.id },
        },
      });

      if (!teacherEnrolled && !tenantCtx.isPlatformStaff) {
        return NextResponse.json(
          { error: "Forbidden: You can only view students in your groups" },
          { status: 403 }
        );
      }
    }

    // Load recent attendances
    const attendances = await tenantDb.attendance.findMany({
      where: { studentMembershipId },
      orderBy: { markedAt: "desc" },
      take: 50,
      include: {
        lesson: {
          select: { id: true, title: true, scheduledAt: true },
        },
      },
    });

    // Load recent grades
    const grades = await tenantDb.grade.findMany({
      where: { studentMembershipId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        lesson: {
          select: { id: true, title: true },
        },
        teacher: {
          include: { user: { select: { fullName: true } } },
        },
      },
    });

    // Load enrollment audit logs (history of drops, transfers, enrollments)
    const auditLogs = await tenantDb.auditLog.findMany({
      where: {
        centerId: tenantCtx.center.id,
        resource: "Student",
        resourceId: studentMembershipId,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      student: studentMembership,
      attendances,
      grades,
      auditLogs,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Failed to load student profile" },
      { status: error.status || 400 }
    );
  }
}
