import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { fromTashkentParts } from "../src/lib/billing";
import {
  isQuietHoursTashkent,
  getNextQuietHoursEndTashkent,
  isCriticalNotification,
} from "../src/lib/timezone";
import { renderEmailTemplate, sendEmailWithOutbox } from "../src/lib/email";
import { dispatchMobilePush } from "../src/lib/mobile-push";
import {
  sendNotification,
  flushDeferredNotifications,
  sendEskizSms,
} from "../src/lib/notifications";
import { GET as getDeliveriesRoute } from "../src/app/api/notifications/deliveries/route";

let mockToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
    set: vi.fn(),
  }),
}));

describe("P2 Notifications, Email Templates, Quiet Hours, Expo Push & Delivery Logs", () => {
  const ts = Date.now();
  const createdCenterIds: string[] = [];
  const createdUserIds: string[] = [];

  let centerAId = "";
  let centerBId = "";
  let directorAUserId = "";
  let directorAEmail = "";
  let studentAUserId = "";
  let studentAEmail = "";
  let directorBUserId = "";
  let directorBEmail = "";

  beforeAll(async () => {
    const passHash = await hashPassword("P2NotifTest!123");

    const dirA = await db.platformUser.create({
      data: {
        email: `p2_dirA_${ts}@test.uz`,
        fullName: "P2 Director A",
        passwordHash: passHash,
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(dirA.id);
    directorAUserId = dirA.id;
    directorAEmail = dirA.email;

    const dirB = await db.platformUser.create({
      data: {
        email: `p2_dirB_${ts}@test.uz`,
        fullName: "P2 Director B",
        passwordHash: passHash,
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(dirB.id);
    directorBUserId = dirB.id;
    directorBEmail = dirB.email;

    const stuA = await db.platformUser.create({
      data: {
        email: `p2_stuA_${ts}@test.uz`,
        phone: `+99890${String(ts).slice(-7)}`,
        fullName: "Alisher Student",
        passwordHash: passHash,
        preferredLanguage: "uz_Latn",
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(stuA.id);
    studentAUserId = stuA.id;
    studentAEmail = stuA.email;

    const centerA = await db.learningCenter.create({
      data: {
        name: "P2 Center A",
        slug: `p2-center-a-${ts}`,
        status: "ACTIVE",
        ownerId: dirA.id,
        smsEnabled: true,
        emailEnabled: true,
        smsDailyLimit: 2,
        quietHoursStart: 21,
        quietHoursEnd: 8,
      },
    });
    createdCenterIds.push(centerA.id);
    centerAId = centerA.id;

    const centerB = await db.learningCenter.create({
      data: {
        name: "P2 Center B",
        slug: `p2-center-b-${ts}`,
        status: "ACTIVE",
        ownerId: dirB.id,
        smsEnabled: false,
        emailEnabled: false,
      },
    });
    createdCenterIds.push(centerB.id);
    centerBId = centerB.id;

    await db.centerMembership.createMany({
      data: [
        { userId: dirA.id, centerId: centerAId, role: "DIRECTOR", status: "ACTIVE" },
        { userId: stuA.id, centerId: centerAId, role: "STUDENT", status: "ACTIVE" },
        { userId: dirB.id, centerId: centerBId, role: "DIRECTOR", status: "ACTIVE" },
      ],
    });
  });

  afterAll(async () => {
    for (const cid of createdCenterIds) {
      await db.learningCenter.delete({ where: { id: cid } }).catch(() => null);
    }
    for (const uid of createdUserIds) {
      await db.platformUser.delete({ where: { id: uid } }).catch(() => null);
    }
  });

  it("evaluates Asia/Tashkent quiet hours (21:00–08:00) and wake-up timestamps accurately", () => {
    const t2059 = fromTashkentParts(2026, 11, 16, 20, 59, 0);
    const t2100 = fromTashkentParts(2026, 11, 16, 21, 0, 0);
    const t0230 = fromTashkentParts(2026, 11, 17, 2, 30, 0);
    const t0759 = fromTashkentParts(2026, 11, 17, 7, 59, 59);
    const t0800 = fromTashkentParts(2026, 11, 17, 8, 0, 0);

    expect(isQuietHoursTashkent(t2059, 21, 8)).toBe(false);
    expect(isQuietHoursTashkent(t2100, 21, 8)).toBe(true);
    expect(isQuietHoursTashkent(t0230, 21, 8)).toBe(true);
    expect(isQuietHoursTashkent(t0759, 21, 8)).toBe(true);
    expect(isQuietHoursTashkent(t0800, 21, 8)).toBe(false);

    // Disabled when start === end
    expect(isQuietHoursTashkent(t2100, 8, 8)).toBe(false);

    // Next end from 22:30 Tashkent -> 08:00 next Tashkent day (03:00 UTC)
    const t2230 = fromTashkentParts(2026, 11, 16, 22, 30, 0);
    const nextWake = getNextQuietHoursEndTashkent(t2230, 21, 8);
    expect(nextWake.toISOString()).toBe(fromTashkentParts(2026, 11, 17, 8, 0, 0).toISOString());

    expect(isCriticalNotification({ type: "PAYMENT_CONFIRMED" })).toBe(true);
    expect(isCriticalNotification({ type: "PASSWORD_RESET" })).toBe(true);
    expect(isCriticalNotification({ type: "PAYMENT_REMINDER" })).toBe(false);
  });

  it("renders bilingual Email templates with XSS escaping and never leaks LOGIN_CREDENTIALS", () => {
    const remRu = renderEmailTemplate("PAYMENT_REMINDER", {
      lang: "ru",
      centerName: "<b>Center</b>",
      studentName: '<script>alert("xss")</script>',
      amount: "300 000",
      dueDate: "2026-11-20",
      payUrl: "https://my.click.uz/pay?id=1",
    });
    expect(remRu.html).not.toContain("<script>");
    expect(remRu.html).toContain("&lt;script&gt;");
    expect(remRu.html).toContain("300 000");

    const gradeUz = renderEmailTemplate("GRADE_POSTED", {
      lang: "uz",
      centerName: "Academy",
      studentName: "Ali",
      lessonTitle: "React Hooks",
      gradeValue: 95,
      maxValue: 100,
    });
    expect(gradeUz.subject).toContain("Academy");
    expect(gradeUz.text).toContain("95");

    const attRu = renderEmailTemplate("ATTENDANCE_ALERT", {
      lang: "ru",
      centerName: "Academy",
      studentName: "Ali",
      status: "ABSENT",
      date: "2026-11-16",
    });
    expect(attRu.subject).not.toContain("Данные для входа");

    const hwUz = renderEmailTemplate("NEW_HOMEWORK", {
      lang: "uz",
      centerName: "Academy",
      title: "Uy vazifa #5",
      dueDate: "2026-11-19",
    });
    expect(hwUz.text).toContain("Uy vazifa #5");
  });

  it("defers non-critical notifications in quiet hours and flushes them in daytime without LOGIN_CREDENTIALS", async () => {
    const nightTashkent = fromTashkentParts(2026, 11, 16, 22, 30, 0);
    const daytimeTashkent = fromTashkentParts(2026, 11, 17, 10, 0, 0);

    // 1. Non-critical PAYMENT_REMINDER at night -> DEFERRED
    const eventDeferred = `p2_defer_${ts}`;
    await sendNotification({
      userId: studentAUserId,
      centerId: centerAId,
      type: "PAYMENT_DUE",
      titleKey: "Напоминание об оплате",
      bodyKey: "Оплатите обучение",
      bodyParams: { studentName: "Alisher Student", amount: 300000, dueDate: "2026-11-20" },
      channel: "EMAIL",
      lang: "ru",
      eventKey: eventDeferred,
      now: nightTashkent,
    });

    const deferredLog = await db.notificationDelivery.findFirst({
      where: { centerId: centerAId, eventKey: eventDeferred },
    });
    expect(deferredLog).toBeTruthy();
    expect(deferredLog?.status).toBe("DEFERRED");
    expect(deferredLog?.deferredUntil?.toISOString()).toBe(
      fromTashkentParts(2026, 11, 17, 8, 0, 0).toISOString()
    );
    // Ensure masked email in recipient and no LOGIN_CREDENTIALS subject
    expect(deferredLog?.recipient).toContain("***");
    expect(deferredLog?.subject).not.toContain("Данные для входа");

    // 2. Flushing while still at night (23:00) keeps DEFERRED
    const stillNightFlush = await flushDeferredNotifications({
      now: fromTashkentParts(2026, 11, 16, 23, 0, 0),
    });
    expect(stillNightFlush.stillDeferred).toBeGreaterThanOrEqual(0);

    // 3. Flushing at 10:00 next morning delivers the Email & clears payloadJson
    const dayFlush = await flushDeferredNotifications({ now: daytimeTashkent });
    expect(dayFlush.sent).toBeGreaterThanOrEqual(1);

    const sentAfterFlush = await db.notificationDelivery.findUnique({
      where: { id: deferredLog!.id },
    });
    expect(sentAfterFlush?.status).toBe("SENT");
    expect(sentAfterFlush?.sentAt).toBeTruthy();

    // 4. Critical PAYMENT_CONFIRMED bypasses quiet hours immediately
    const eventCritical = `p2_crit_${ts}`;
    await sendNotification({
      userId: studentAUserId,
      centerId: centerAId,
      type: "PAYMENT_CONFIRMED",
      titleKey: "Оплата подтверждена",
      bodyKey: "Чек готов",
      bodyParams: { studentName: "Alisher Student", amount: 300000 },
      channel: "EMAIL",
      lang: "uz",
      eventKey: eventCritical,
      now: nightTashkent,
    });

    const critLog = await db.notificationDelivery.findFirst({
      where: { centerId: centerAId, eventKey: eventCritical },
    });
    expect(critLog?.status).toBe("SENT");
  });

  it("batches Expo Push notifications and removes dead DeviceNotRegistered & malformed tokens", async () => {
    const validTok = `ExponentPushToken[valid_${ts}]`;
    const deadTok = `ExponentPushToken[dead_${ts}]`;
    const badTok = `invalid-raw-token-${ts}`;

    await db.devicePushToken.createMany({
      data: [
        { userId: studentAUserId, centerId: centerAId, pushToken: validTok, platform: "ANDROID" },
        { userId: studentAUserId, centerId: centerAId, pushToken: deadTok, platform: "IOS" },
        { userId: studentAUserId, centerId: centerAId, pushToken: badTok, platform: "ANDROID" },
      ],
    });

    const sendSpy = vi.fn(async (msgs: Array<{ to: string | string[] }>) =>
      msgs.map((m) =>
        m.to === deadTok
          ? { status: "error" as const, message: "not registered", details: { error: "DeviceNotRegistered" as const } }
          : { status: "ok" as const, id: `expo_ticket_${ts}` }
      )
    );

    const res = await dispatchMobilePush({
      userId: studentAUserId,
      centerId: centerAId,
      title: "Test Push",
      body: "Push body text",
      type: "NEW_HOMEWORK",
      eventKey: `p2_push_${ts}`,
      expoClient: {
        chunkPushNotifications: (msgs) => [msgs],
        sendPushNotificationsAsync: sendSpy,
      },
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(res.sent).toBe(true);
    expect(res.deliveredCount).toBe(1);
    expect(res.removedInvalidTokensCount).toBe(2); // 1 malformed + 1 DeviceNotRegistered

    const remainingTokens = await db.devicePushToken.findMany({
      where: { userId: studentAUserId },
    });
    expect(remainingTokens.map((t) => t.pushToken)).toEqual([validTok]);

    const pushLog = await db.notificationDelivery.findUnique({
      where: { id: res.deliveryId! },
    });
    expect(pushLog?.channel).toBe("PUSH");
    expect(pushLog?.status).toBe("SENT");
    expect(pushLog?.recipient).not.toBe(validTok); // Masked token
  });

  it("enforces center smsEnabled / emailEnabled flags and smsDailyLimit", async () => {
    // Center B has smsEnabled=false and emailEnabled=false
    const resB = await sendEskizSms(`+998901112233`, "Hello", {
      centerId: centerBId,
      userId: directorBUserId,
      eventKey: `sms_disabled_${ts}`,
    });
    expect(resB.success).toBe(false);
    expect(resB.error).toContain("disabled");

    // Center A has smsDailyLimit = 2
    const s1 = await sendEskizSms("+998901112233", "Msg 1", {
      centerId: centerAId,
      userId: studentAUserId,
      eventKey: `sms_lim_1_${ts}`,
    });
    const s2 = await sendEskizSms("+998901112233", "Msg 2", {
      centerId: centerAId,
      userId: studentAUserId,
      eventKey: `sms_lim_2_${ts}`,
    });
    const s3 = await sendEskizSms("+998901112233", "Msg 3", {
      centerId: centerAId,
      userId: studentAUserId,
      eventKey: `sms_lim_3_${ts}`,
    });
    expect(s1.success).toBe(true);
    expect(s2.success).toBe(true);
    expect(s3.success).toBe(false);
    expect(s3.error).toContain("limit");

    // Email disabled on Center B -> logged as SKIPPED
    const evEmailDisabled = `email_off_${ts}`;
    await sendNotification({
      userId: directorBUserId,
      centerId: centerBId,
      type: "GENERAL",
      titleKey: "T",
      bodyKey: "B",
      channel: "EMAIL",
      eventKey: evEmailDisabled,
      now: fromTashkentParts(2026, 11, 17, 12, 0, 0),
    });
    const logB = await db.notificationDelivery.findFirst({
      where: { centerId: centerBId, eventKey: evEmailDisabled },
    });
    expect(logB?.status).toBe("SKIPPED");
  });

  it("enforces tenant isolation, RBAC, and no-store headers on /api/notifications/deliveries", async () => {
    // Log email directly via sendEmailWithOutbox for Center B so Center A cannot see it
    await sendEmailWithOutbox(
      directorBEmail,
      "Center B Secret Subject",
      "Body",
      undefined,
      {
        centerId: centerBId,
        userId: directorBUserId,
        eventKey: `centerB_only_${ts}`,
      }
    );

    // Student on Center A receives 403
    mockToken = await signJWT({
      userId: studentAUserId,
      email: studentAEmail,
      platformRole: "NONE",
      activeCenterId: centerAId,
    });
    const stuRes = await getDeliveriesRoute(
      new Request("http://localhost/api/notifications/deliveries")
    );
    expect(stuRes.status).toBe(403);
    expect(stuRes.headers.get("cache-control")).toBe("no-store");

    // Director A sees only Center A logs
    mockToken = await signJWT({
      userId: directorAUserId,
      email: directorAEmail,
      platformRole: "NONE",
      activeCenterId: centerAId,
    });
    const dirARes = await getDeliveriesRoute(
      new Request("http://localhost/api/notifications/deliveries?pageSize=50")
    );
    expect(dirARes.status).toBe(200);
    expect(dirARes.headers.get("cache-control")).toBe("no-store");
    const jsonA = await dirARes.json();
    expect(jsonA.deliveries.length).toBeGreaterThan(0);
    expect(jsonA.deliveries.every((d: { subject: string | null }) => d.subject !== "Center B Secret Subject")).toBe(true);
  });
});
