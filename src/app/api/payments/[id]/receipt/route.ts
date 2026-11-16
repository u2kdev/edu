import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { generateReceiptPdf } from "@/lib/receipt-pdf";
import {
  computeReceiptVerifyCode,
  computeReceiptVerifyHash,
} from "@/lib/receipt-verify";
import {
  requirePlanFeature,
  PlanFeatureLockedError,
  formatPlanFeatureLockedPayload,
} from "@/lib/plan-features";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const paymentId = context.params.id;

    if (!paymentId) {
      return NextResponse.json(
        { error: "Не указан идентификатор платежа" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await requirePlanFeature(tenantCtx.center.id, "pdfReceipts");

    const payment = await tenantDb.centerPayment.findFirst({
      where: { id: paymentId, deletedAt: null },
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
          },
        },
        group: {
          select: {
            name: true,
            course: { select: { title: true } },
          },
        },
        center: {
          select: {
            name: true,
            legalName: true,
            inn: true,
            address: true,
            phone: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Квитанция не найдена" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    // Strict IDOR authorization check: evaluate scoped roles (STUDENT/PARENT/TEACHER) BEFORE general staff permission
    // because PARENT carries "payments.read" for own children only in permissions.ts.
    let authorized = false;

    if (tenantCtx.isPlatformStaff) {
      authorized = true;
    } else if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      authorized = payment.studentMembershipId === tenantCtx.membership.id;
    } else if (tenantCtx.role === "PARENT" && tenantCtx.membership) {
      const link = await tenantDb.parentLink.findFirst({
        where: {
          parentMembershipId: tenantCtx.membership.id,
          studentMembershipId: payment.studentMembershipId,
          status: "CONFIRMED",
        },
        select: { id: true },
      });
      authorized = Boolean(link);
    } else if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      if (payment.groupId) {
        const grp = await tenantDb.group.findFirst({
          where: { id: payment.groupId, teacherMembershipId: tenantCtx.membership.id },
          select: { id: true },
        });
        authorized = Boolean(grp);
      }
    } else {
      authorized = hasPermission(
        "payments.read",
        tenantCtx.session.user.platformRole,
        tenantCtx.role
      );
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Forbidden: Нет доступа к данной квитанции" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const verifyCode = computeReceiptVerifyCode(payment.id);
    const verifyHash = computeReceiptVerifyHash(verifyCode);
    const receiptNumber =
      payment.receiptNumber || `RCP-${payment.id.slice(0, 8).toUpperCase()}`;

    // Backfill legacy payments missing receiptNumber / receiptVerifyHash so QR code validates
    if (!payment.receiptVerifyHash || !payment.receiptNumber) {
      await tenantDb.centerPayment.updateMany({
        where: { id: payment.id },
        data: {
          receiptNumber,
          receiptVerifyHash: verifyHash,
        },
      });
    }

    const url = new URL(req.url);
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      `${url.protocol}//${url.host}`;
    const verifyUrl = `${baseUrl.replace(/\/+$/, "")}/verify/receipt/${verifyCode}`;

    const langParam = url.searchParams.get("lang");
    const sessionLang = tenantCtx.session.user.preferredLanguage;
    const isSessionUz = sessionLang === "uz-Latn" || sessionLang === "uz_Latn";
    const lang: "ru" | "uz-Latn" =
      langParam === "uz-Latn" || (langParam !== "ru" && isSessionUz)
        ? "uz-Latn"
        : "ru";

    const pdfBytes = await generateReceiptPdf({
      receiptNumber,
      verifyUrl,
      verifyCode,
      lang,
      centerName: payment.center.name,
      centerLegalName: payment.center.legalName,
      centerInn: payment.center.inn,
      centerAddress: payment.center.address,
      centerPhone: payment.center.phone,
      studentName: payment.student.user.fullName,
      groupName: payment.group?.name ?? null,
      courseTitle: payment.group?.course?.title ?? null,
      periodStart: payment.periodStart,
      periodEnd: payment.periodEnd,
      originalAmount: payment.originalAmount ?? payment.amount,
      discountAmount: payment.discountAmount ?? 0,
      discountReason: payment.discountReason,
      paidAmount: payment.amount,
      refundedAmount: payment.refundedAmount ?? 0,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    });

    const safeFileName = receiptNumber.replace(/[^A-Za-z0-9_-]/g, "_");
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="receipt-${safeFileName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    if (err instanceof PlanFeatureLockedError) {
      return NextResponse.json(formatPlanFeatureLockedPayload(err), {
        status: 403,
        headers: NO_STORE_HEADERS,
      });
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка формирования квитанции" },
      { status: error?.status || 500, headers: NO_STORE_HEADERS }
    );
  }
}
