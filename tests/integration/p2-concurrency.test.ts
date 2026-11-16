import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/auth";
import { fromTashkentParts, addCalendarDays } from "../../src/lib/billing";
import { createTelegramLinkToken, consumeTelegramLinkToken } from "../../src/lib/telegram";
import { runPaymentRemindersCron } from "../../src/lib/payment-reminders";
import { executeBroadcast } from "../../src/lib/broadcasts";

describe("PostgreSQL Concurrency Integration Tests (P2 Communications & Reminders)", () => {
  const ts = Date.now();
  const createdCenterIds: string[] = [];
  const createdUserIds: string[] = [];

  let centerId = "";
  let dirUserId = "";
  let stuUserId = "";
  let stuMemId = "";
  let broadcastId = "";

  const cronDay = fromTashkentParts(2026, 11, 20, 10, 0, 0);

  beforeAll(async () => {
    const passHash = await hashPassword("PgP2Int!123");

    const dir = await db.platformUser.create({
      data: {
        email: `pgp2_dir_${ts}@integration.test`,
        fullName: "PG P2 Director",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    const stu = await db.platformUser.create({
      data: {
        email: `pgp2_stu_${ts}@integration.test`,
        phone: `+99890${String(ts).slice(-7)}`,
        fullName: "PG P2 Student",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(dir.id, stu.id);
    dirUserId = dir.id;
    stuUserId = stu.id;

    const center = await db.learningCenter.create({
      data: {
        name: "PG P2 Integration Center",
        slug: `pgp2-center-${ts}`,
        status: "ACTIVE",
        ownerId: dir.id,
        smsEnabled: true,
        emailEnabled: true,
        paymentReminderEnabled: true,
        paymentReminderDaysJson: JSON.stringify([0]),
        quietHoursStart: 8,
        quietHoursEnd: 8,
      },
    });
    createdCenterIds.push(center.id);
    centerId = center.id;

    const [dirMem, stuMem] = await Promise.all([
      db.centerMembership.create({
        data: { userId: dir.id, centerId, role: "DIRECTOR", status: "ACTIVE" },
      }),
      db.centerMembership.create({
        data: { userId: stu.id, centerId, role: "STUDENT", status: "ACTIVE" },
      }),
    ]);
    stuMemId = stuMem.id;

    const course = await db.course.create({
      data: { centerId, title: "Concurrency Course", priceMonthly: 450000, createdByMembershipId: dirMem.id },
    });
    const group = await db.group.create({
      data: { centerId, courseId: course.id, name: "PG-P2", teacherMembershipId: dirMem.id },
    });
    const enrollment = await db.enrollment.create({
      data: {
        centerId,
        groupId: group.id,
        studentMembershipId: stuMem.id,
        status: "ACTIVE",
        paidUntil: cronDay,
      },
    });
    await db.charge.create({
      data: {
        centerId,
        enrollmentId: enrollment.id,
        studentMembershipId: stuMem.id,
        groupId: group.id,
        invoiceNumber: `INV-PGP2-${ts}`,
        periodMonths: 1,
        periodStart: cronDay,
        periodEnd: addCalendarDays(cronDay, 30),
        originalAmount: 450000,
        amount: 450000,
        paidAmount: 0,
        dueDate: cronDay,
        status: "PENDING",
      },
    });

    const bc = await db.broadcast.create({
      data: {
        centerId,
        createdByUserId: dirUserId,
        title: "PG Parallel Broadcast",
        bodyRu: "Привет, {{studentName}}",
        channel: "IN_APP",
        audience: "ROLE",
        targetRole: "STUDENT",
        status: "DRAFT",
      },
    });
    broadcastId = bc.id;
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

  it("allows only 1 winning runner out of 5 concurrent runPaymentRemindersCron calls (zero duplicate PaymentReminderLog)", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => runPaymentRemindersCron({ centerId, now: cronDay }))
    );

    const totalSent = results.reduce((s, r) => s + r.remindersSent, 0);
    expect(totalSent).toBe(1);

    const logs = await db.paymentReminderLog.findMany({
      where: { centerId, studentMembershipId: stuMemId },
    });
    expect(logs.length).toBe(1);
  });

  it("allows only 1 consumeTelegramLinkToken under 5 concurrent attempts on the same single-use token", async () => {
    const generated = await createTelegramLinkToken(stuUserId);

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, (_, idx) =>
        consumeTelegramLinkToken({
          rawToken: generated.token,
          telegramId: `pg_tg_${ts}`,
          chatId: `pg_chat_${ts}`,
          username: `race_${idx}`,
        })
      )
    );

    const winners = outcomes.filter((o) => o.ok);
    const losers = outcomes.filter((o) => !o.ok);
    expect(winners.length).toBe(1);
    expect(losers.length).toBe(4);
  });

  it("executes a Broadcast exactly once under 5 parallel executeBroadcast invocations", async () => {
    const runs = await Promise.all(
      Array.from({ length: 5 }, () => executeBroadcast(broadcastId, { now: cronDay }))
    );

    const winners = runs.filter((r) => r.sentCount === 1);
    expect(winners.length).toBe(1);

    const recipients = await db.broadcastRecipient.findMany({
      where: { broadcastId },
    });
    expect(recipients.length).toBe(1);
  });
});
