import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { encryptSecret } from "../src/lib/crypto-cipher";
import { addCalendarDays, formatTashkentYMD, fromTashkentParts } from "../src/lib/billing";
import { calculateStudentBalances } from "../src/lib/student-balance";
import { runPaymentRemindersCron } from "../src/lib/payment-reminders";

describe("P2 Hourly Payment Reminders Cron (-3, 0, +3, +7 Asia/Tashkent)", () => {
  const ts = Date.now();
  const createdCenterIds: string[] = [];
  const createdUserIds: string[] = [];

  let centerId = "";
  let dirUserId = "";
  let stuUpcomingMemId = "";
  let stuUpcomingUserId = "";
  let stuOverdue3MemId = "";
  let stuOverdue3UserId = "";
  let stuOverdue7MemId = "";
  let stuOverdue7UserId = "";
  let stuFrozenMemId = "";
  let stuPaidZeroMemId = "";

  const baseDay = fromTashkentParts(2026, 11, 16, 10, 0, 0);

  beforeAll(async () => {
    const passHash = await hashPassword("CronTest!123");

    const dir = await db.platformUser.create({
      data: {
        email: `cron_dir_${ts}@test.uz`,
        fullName: "Cron Director",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(dir.id);
    dirUserId = dir.id;

    const uUpcoming = await db.platformUser.create({
      data: {
        email: `cron_up_${ts}@test.uz`,
        fullName: "Student Upcoming",
        preferredLanguage: "uz_Latn",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const uOverdue3 = await db.platformUser.create({
      data: {
        email: `cron_ov3_${ts}@test.uz`,
        phone: `+99891${String(ts).slice(-7)}`,
        fullName: "Student Overdue3",
        preferredLanguage: "ru",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const uOverdue7 = await db.platformUser.create({
      data: {
        email: `cron_ov7_${ts}@test.uz`,
        phone: `+99893${String(ts).slice(-7)}`,
        fullName: "Student Overdue7",
        preferredLanguage: "ru",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const uFrozen = await db.platformUser.create({
      data: {
        email: `cron_frz_${ts}@test.uz`,
        phone: `+99894${String(ts).slice(-7)}`,
        fullName: "Student Frozen",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const uPaid = await db.platformUser.create({
      data: {
        email: `cron_paid_${ts}@test.uz`,
        phone: `+99895${String(ts).slice(-7)}`,
        fullName: "Student Paid",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });

    createdUserIds.push(uUpcoming.id, uOverdue3.id, uOverdue7.id, uFrozen.id, uPaid.id);
    stuUpcomingUserId = uUpcoming.id;
    stuOverdue3UserId = uOverdue3.id;
    stuOverdue7UserId = uOverdue7.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Cron Test Center",
        slug: `cron-center-${ts}`,
        status: "ACTIVE",
        ownerId: dir.id,
        smsEnabled: true,
        emailEnabled: true,
        paymentReminderEnabled: true,
        paymentReminderDaysJson: JSON.stringify([-3, 0, 3, 7]),
        quietHoursStart: 21,
        quietHoursEnd: 8,
        reminderTemplateRu: "Напоминаем {{studentName}}: к оплате {{amount}} сум до {{dueDate}}. {{payUrl}}",
        reminderTemplateUz: "Hurmatli {{studentName}}: {{amount}} so'm to'lang ({{dueDate}}). {{payUrl}}",
      },
    });
    createdCenterIds.push(center.id);
    centerId = center.id;

    await db.centerMerchantConfig.create({
      data: {
        centerId,
        provider: "CLICK",
        serviceId: "99111",
        merchantId: "99222",
        encryptedSecretKey: encryptSecret(`cron_sec_${ts}`),
        isActive: true,
        isVerified: true,
      },
    });

    const dirMem = await db.centerMembership.create({
      data: { userId: dir.id, centerId, role: "DIRECTOR", status: "ACTIVE" },
    });
    const mUp = await db.centerMembership.create({
      data: { userId: uUpcoming.id, centerId, role: "STUDENT", status: "ACTIVE" },
    });
    const mOv3 = await db.centerMembership.create({
      data: { userId: uOverdue3.id, centerId, role: "STUDENT", status: "ACTIVE" },
    });
    const mOv7 = await db.centerMembership.create({
      data: { userId: uOverdue7.id, centerId, role: "STUDENT", status: "ACTIVE" },
    });
    const mFrz = await db.centerMembership.create({
      data: { userId: uFrozen.id, centerId, role: "STUDENT", status: "ACTIVE" },
    });
    const mPaid = await db.centerMembership.create({
      data: { userId: uPaid.id, centerId, role: "STUDENT", status: "ACTIVE" },
    });

    stuUpcomingMemId = mUp.id;
    stuOverdue3MemId = mOv3.id;
    stuOverdue7MemId = mOv7.id;
    stuFrozenMemId = mFrz.id;
    stuPaidZeroMemId = mPaid.id;

    // Channel priority fixtures:
    // Upcoming -> Telegram linked
    await db.telegramAccount.create({
      data: {
        userId: uUpcoming.id,
        telegramId: `cron_tg_${ts}`,
        chatId: `cron_tg_${ts}`,
        isActive: true,
        isBlocked: false,
      },
    });
    // Overdue +3 -> Push token + phone (should pick PUSH before SMS!)
    await db.devicePushToken.create({
      data: {
        userId: uOverdue3.id,
        centerId,
        pushToken: `ExponentPushToken[cron_push_${ts}]`,
        platform: "ANDROID",
      },
    });
    // Overdue +7 -> Phone only (should pick SMS!)

    const course = await db.course.create({
      data: { centerId, title: "Cron Math", priceMonthly: 350000, createdByMembershipId: dirMem.id },
    });
    const group = await db.group.create({
      data: { centerId, courseId: course.id, name: "M-1", teacherMembershipId: dirMem.id },
    });

    // +3 days upcoming
    const in3Days = addCalendarDays(baseDay, 3);
    // -3 days overdue
    const ago3Days = addCalendarDays(baseDay, -3);
    // -7 days overdue
    const ago7Days = addCalendarDays(baseDay, -7);
    // +15 days paid zero
    const in15Days = addCalendarDays(baseDay, 15);

    const [, eOv3, eOv7, eFrz] = await Promise.all([
      db.enrollment.create({
        data: { centerId, groupId: group.id, studentMembershipId: mUp.id, status: "ACTIVE", paidUntil: in3Days },
      }),
      db.enrollment.create({
        data: { centerId, groupId: group.id, studentMembershipId: mOv3.id, status: "ACTIVE", paidUntil: ago3Days },
      }),
      db.enrollment.create({
        data: { centerId, groupId: group.id, studentMembershipId: mOv7.id, status: "ACTIVE", paidUntil: ago7Days },
      }),
      db.enrollment.create({
        data: { centerId, groupId: group.id, studentMembershipId: mFrz.id, status: "FROZEN", paidUntil: ago3Days },
      }),
      db.enrollment.create({
        data: { centerId, groupId: group.id, studentMembershipId: mPaid.id, status: "ACTIVE", paidUntil: in15Days },
      }),
    ]);

    // Open unpaid charges matching offsets & amounts
    await db.charge.createMany({
      data: [
        {
          centerId,
          enrollmentId: eOv3.id,
          studentMembershipId: mOv3.id,
          groupId: group.id,
          invoiceNumber: `INV-OV3-${ts}`,
          periodMonths: 1,
          periodStart: ago3Days,
          periodEnd: addCalendarDays(ago3Days, 30),
          originalAmount: 350000,
          amount: 350000,
          paidAmount: 50000, // 300 000 debt
          dueDate: ago3Days,
          status: "PARTIAL",
        },
        {
          centerId,
          enrollmentId: eOv7.id,
          studentMembershipId: mOv7.id,
          groupId: group.id,
          invoiceNumber: `INV-OV7-${ts}`,
          periodMonths: 1,
          periodStart: ago7Days,
          periodEnd: addCalendarDays(ago7Days, 30),
          originalAmount: 350000,
          amount: 350000,
          paidAmount: 0, // 350 000 debt
          dueDate: ago7Days,
          status: "PENDING",
        },
        {
          centerId,
          enrollmentId: eFrz.id,
          studentMembershipId: mFrz.id,
          groupId: group.id,
          invoiceNumber: `INV-FRZ-${ts}`,
          periodMonths: 1,
          periodStart: ago3Days,
          periodEnd: addCalendarDays(ago3Days, 30),
          originalAmount: 350000,
          amount: 350000,
          paidAmount: 0,
          dueDate: ago3Days,
          status: "PENDING",
        },
      ],
    });
  });

  afterAll(async () => {
    for (const cid of createdCenterIds) {
      await db.charge.deleteMany({ where: { centerId: cid } }).catch(() => null);
      await db.learningCenter.delete({ where: { id: cid } }).catch(() => null);
    }
    for (const uid of createdUserIds) {
      await db.platformUser.delete({ where: { id: uid } }).catch(() => null);
    }
  });

  it("defers during quiet hours, sends with TELEGRAM->PUSH->SMS priority, uses single-source debt amount, and deduplicates repeat runs", async () => {
    // Verify debt amounts match calculateStudentBalances
    const balances = await calculateStudentBalances({ centerId });
    const balOv3 = balances.find((b) => b.studentMembershipId === stuOverdue3MemId)!;
    expect(balOv3.debtAmount).toBe(300000);

    // 1. Run cron at 22:30 Tashkent (quiet hours) -> creates PaymentReminderLogs + DEFERRED deliveries
    const nightNow = fromTashkentParts(2026, 11, 16, 22, 30, 0);
    const nightRes = await runPaymentRemindersCron({ centerId, now: nightNow });

    expect(nightRes.remindersDeferred).toBe(3); // Upcoming(-3), Overdue(+3), Overdue(+7); NOT Frozen, NOT Paid(+15)
    expect(nightRes.remindersSent).toBe(0);

    const logs = await db.paymentReminderLog.findMany({ where: { centerId } });
    expect(logs.length).toBe(3);

    const upLog = logs.find((l) => l.studentMembershipId === stuUpcomingMemId)!;
    const ov3Log = logs.find((l) => l.studentMembershipId === stuOverdue3MemId)!;
    const ov7Log = logs.find((l) => l.studentMembershipId === stuOverdue7MemId)!;

    expect(upLog.offsetDays).toBe(-3);
    expect(upLog.channel).toBe("TELEGRAM");
    expect(ov3Log.offsetDays).toBe(3);
    expect(ov3Log.channel).toBe("PUSH");
    expect(ov7Log.offsetDays).toBe(7);
    expect(ov7Log.channel).toBe("SMS");

    // Frozen & Paid students never get reminder logs
    expect(logs.some((l) => l.studentMembershipId === stuFrozenMemId)).toBe(false);
    expect(logs.some((l) => l.studentMembershipId === stuPaidZeroMemId)).toBe(false);

    // Verify rendered custom template + debt amount + Click link on Overdue(+3) delivery
    const ov3Delivery = await db.notificationDelivery.findUnique({ where: { id: ov3Log.deliveryId! } });
    expect(ov3Delivery?.status).toBe("DEFERRED");
    expect(ov3Delivery?.payloadJson).toContain("300 000");
    expect(ov3Delivery?.payloadJson).toContain("click.uz");

    // 2. Run cron next morning 10:00 (still different Tashkent day!) — WAIT notice:
    // let's flush deferred at next morning 09:00 on the SAME logical reminder window check vs re-running at 11:00 on 2026-11-16 first:
    // Actually on the SAME Tashkent calendar day 2026-11-16 at 10:00 (after quiet hours? Wait deferredUntil from Nov 16 22:30 is Nov 17 08:00!).
    // So if we test idempotency on 2026-11-16 at 23:30 first: repeat run skips all 3 duplicates AND does NOT send 2nd Director digest!
    const sameNightRepeat = await runPaymentRemindersCron({
      centerId,
      now: fromTashkentParts(2026, 11, 16, 23, 30, 0),
    });
    expect(sameNightRepeat.remindersSkippedDuplicate).toBe(3);
    expect(sameNightRepeat.remindersSent).toBe(0);
    expect(sameNightRepeat.directorDigestsSent).toBe(0); // Already sent once today!

    const digests = await db.notification.findMany({
      where: {
        userId: dirUserId,
        centerId,
        dedupeKey: `reminder-digest:${centerId}:${formatTashkentYMD(nightNow)}:${dirUserId}`,
      },
    });
    expect(digests.length).toBe(1);

    // 3. Flush after 08:00 next Tashkent day (2026-11-17 08:05) -> flushes the 3 deferred notifications!
    const morningFlushRes = await runPaymentRemindersCron({
      centerId,
      now: fromTashkentParts(2026, 11, 17, 8, 5, 0),
    });
    expect(morningFlushRes.deferredFlushed.sent).toBeGreaterThanOrEqual(2);

    const ov3After = await db.notificationDelivery.findUnique({ where: { id: ov3Log.deliveryId! } });
    expect(ov3After?.status).toBe("SENT");
  });
});
