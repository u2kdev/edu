import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hashPassword } from "@/lib/auth";
import { getTenantDb } from "@/lib/db-tenant";
import crypto from "crypto";

// POST /api/invites/bulk-import - Bulk import students from CSV data (fullName, email, phone)
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { students, groupId } = await req.json();

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: "Provide a valid array of student records" }, { status: 400 });
    }

    const results = {
      added: 0,
      existing: 0,
      errors: [] as string[],
    };

    const tenantDb = getTenantDb(tenantCtx.center.id);

    for (const item of students) {
      const email = item.email?.toLowerCase().trim();
      const fullName = item.fullName?.trim();
      const phone = item.phone?.trim();

      if (!email || !fullName) {
        results.errors.push(`Missing email or fullName for record: ${JSON.stringify(item)}`);
        continue;
      }

      // Find or create User using tenantDb (works because PlatformUser is not filtered by centerId)
      let user = await tenantDb.platformUser.findUnique({ where: { email } });
      if (!user) {
        const tempPasswordHash = await hashPassword(crypto.randomBytes(10).toString("hex"));
        user = await tenantDb.platformUser.create({
          data: {
            email,
            fullName,
            phone: phone || null,
            passwordHash: tempPasswordHash,
            preferredLanguage: tenantCtx.center.defaultLanguage || "ru",
          },
        });
      }

      // Find or create Student Membership
      let membership = await tenantDb.centerMembership.findFirst({
        where: { userId: user.id, role: "STUDENT" },
      });

      if (!membership) {
        membership = await tenantDb.centerMembership.create({
          data: {
            centerId: tenantCtx.center.id,
            userId: user.id,
            role: "STUDENT",
            status: "ACTIVE",
          },
        });
        results.added++;
      } else {
        results.existing++;
      }

      // Enroll in group if specified
      if (groupId) {
        const existingEnrollment = await tenantDb.enrollment.findFirst({
          where: { studentMembershipId: membership.id, groupId },
        });
        if (!existingEnrollment) {
          await tenantDb.enrollment.create({
            data: {
              centerId: tenantCtx.center.id,
              studentMembershipId: membership.id,
              groupId,
              status: "ACTIVE",
            },
          });
        }
      }
    }

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "BULK_STUDENT_IMPORT",
      resource: "CenterMembership",
      details: { count: students.length, added: results.added, groupId },
    });

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
