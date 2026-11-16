import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Update } from "grammy/types";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { encryptSecret } from "../src/lib/crypto-cipher";
import {
  createTelegramLinkToken,
  consumeTelegramLinkToken,
  processTelegramUpdate,
  sendTelegramToUser,
  type TelegramTransportFn,
} from "../src/lib/telegram";
import { POST as telegramWebhookRoute } from "../src/app/api/webhooks/telegram/route";
import {
  GET as getTelegramAccountRoute,
  POST as postTelegramLinkRoute,
  DELETE as deleteTelegramAccountRoute,
} from "../src/app/api/account/telegram/route";

let mockToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
    set: vi.fn(),
  }),
}));

function tgMessageUpdate(updateId: number, chatId: number, userId: number, text: string, chatType: "private" | "group" = "private"): Update {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat:
        chatType === "private"
          ? { id: chatId, type: "private", first_name: "Test" }
          : { id: chatId, type: "group", title: "Test Group" },
      from: {
        id: userId,
        is_bot: false,
        first_name: "Test",
        username: "test_tg",
        language_code: "ru",
      },
      text,
      entities: text.startsWith("/")
        ? [{ type: "bot_command", offset: 0, length: text.split(" ")[0].length }]
        : undefined,
    },
  } as Update;
}

describe("P2 Telegram Bot Webhook, Linking Security & Parent/Student Commands", () => {
  const ts = Date.now();
  const createdCenterIds: string[] = [];
  const createdUserIds: string[] = [];

  let centerId = "";
  let studentUserId = "";
  let studentEmail = "";
  let studentMemId = "";
  let secondStudentUserId = "";
  let secondStudentMemId = "";
  let parentUserId = "";
  let supportUserId = "";
  let supportEmail = "";
  let courseId = "";
  let groupId = "";

  const prevTgSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  beforeAll(async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = `test_tg_secret_${ts}_long`;
    const passHash = await hashPassword("TgTestPass!123");

    const dir = await db.platformUser.create({
      data: {
        email: `tg_dir_${ts}@test.uz`,
        fullName: "TG Director",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(dir.id);

    const stu = await db.platformUser.create({
      data: {
        email: `tg_stu_${ts}@test.uz`,
        fullName: "Dilshod Student",
        passwordHash: passHash,
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(stu.id);
    studentUserId = stu.id;
    studentEmail = stu.email;

    const stu2 = await db.platformUser.create({
      data: {
        email: `tg_stu2_${ts}@test.uz`,
        fullName: "Unconfirmed Child",
        passwordHash: passHash,
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(stu2.id);
    secondStudentUserId = stu2.id;

    const parent = await db.platformUser.create({
      data: {
        email: `tg_par_${ts}@test.uz`,
        fullName: "Madina Parent",
        passwordHash: passHash,
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(parent.id);
    parentUserId = parent.id;

    const support = await db.platformUser.create({
      data: {
        email: `tg_sup_${ts}@test.uz`,
        fullName: "Support Agent",
        passwordHash: passHash,
        platformRole: "PLATFORM_SUPPORT",
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(support.id);
    supportUserId = support.id;
    supportEmail = support.email;

    const center = await db.learningCenter.create({
      data: {
        name: "Telegram Academy",
        slug: `tg-academy-${ts}`,
        status: "ACTIVE",
        ownerId: dir.id,
      },
    });
    createdCenterIds.push(center.id);
    centerId = center.id;

    const dirMem = await db.centerMembership.create({
      data: { userId: dir.id, centerId, role: "DIRECTOR", status: "ACTIVE" },
    });
    const stuMem = await db.centerMembership.create({
      data: { userId: stu.id, centerId, role: "STUDENT", status: "ACTIVE" },
    });
    studentMemId = stuMem.id;

    const stu2Mem = await db.centerMembership.create({
      data: { userId: stu2.id, centerId, role: "STUDENT", status: "ACTIVE" },
    });
    secondStudentMemId = stu2Mem.id;

    const parMem = await db.centerMembership.create({
      data: { userId: parent.id, centerId, role: "PARENT", status: "ACTIVE" },
    });

    await db.parentLink.createMany({
      data: [
        { parentMembershipId: parMem.id, studentMembershipId: stuMem.id, status: "CONFIRMED" },
        { parentMembershipId: parMem.id, studentMembershipId: stu2Mem.id, status: "PENDING" },
      ],
    });

    const course = await db.course.create({
      data: {
        centerId,
        title: "English B2",
        priceMonthly: 400000,
        createdByMembershipId: dirMem.id,
      },
    });
    courseId = course.id;

    const group = await db.group.create({
      data: {
        centerId,
        courseId,
        name: "B2-Morning",
        teacherMembershipId: dirMem.id,
      },
    });
    groupId = group.id;

    const enrollment = await db.enrollment.create({
      data: {
        centerId,
        groupId,
        studentMembershipId: stuMem.id,
        status: "ACTIVE",
        paidUntil: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      },
    });

    const pStart = new Date();
    const pEnd = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    await db.charge.create({
      data: {
        centerId,
        enrollmentId: enrollment.id,
        studentMembershipId: stuMem.id,
        groupId,
        invoiceNumber: `INV-TG-${ts}`,
        periodMonths: 1,
        periodStart: pStart,
        periodEnd: pEnd,
        originalAmount: 400000,
        amount: 400000,
        paidAmount: 0,
        dueDate: pStart,
        status: "PENDING",
      },
    });

    const todayIsoWeekday = (() => {
      const shifted = new Date(Date.now() + 5 * 3600 * 1000);
      const d = shifted.getUTCDay();
      return d === 0 ? 7 : d;
    })();
    await db.scheduleSlot.create({
      data: {
        centerId,
        groupId,
        teacherMembershipId: dirMem.id,
        dayOfWeek: todayIsoWeekday,
        startTime: "14:00",
        endTime: "15:30",
        roomName: "Room 201",
      },
    });

    await db.centerMerchantConfig.create({
      data: {
        centerId,
        provider: "CLICK",
        serviceId: "77711",
        merchantId: "88822",
        encryptedSecretKey: encryptSecret(`sec_${ts}`),
        isActive: true,
        isVerified: true,
      },
    });
  });

  afterAll(async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = prevTgSecret;
    for (const cid of createdCenterIds) {
      await db.charge.deleteMany({ where: { centerId: cid } }).catch(() => null);
      await db.scheduleSlot.deleteMany({ where: { centerId: cid } }).catch(() => null);
      await db.learningCenter.delete({ where: { id: cid } }).catch(() => null);
    }
    for (const uid of createdUserIds) {
      await db.platformUser.delete({ where: { id: uid } }).catch(() => null);
    }
  });

  it("rejects unauthorized Telegram webhook calls with 401 timing-safely", async () => {
    const resNoHeader = await telegramWebhookRoute(
      new Request("http://localhost/api/webhooks/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ update_id: 1 }),
      })
    );
    expect(resNoHeader.status).toBe(401);

    const resWrong = await telegramWebhookRoute(
      new Request("http://localhost/api/webhooks/telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-telegram-bot-api-secret-token": "wrong-secret",
        },
        body: JSON.stringify({ update_id: 2 }),
      })
    );
    expect(resWrong.status).toBe(401);
  });

  it("supports Web & Mobile Bearer linking, blocks PLATFORM_SUPPORT, and stores only SHA-256 hash", async () => {
    // PLATFORM_SUPPORT blocked
    mockToken = await signJWT({
      userId: supportUserId,
      email: supportEmail,
      platformRole: "PLATFORM_SUPPORT",
      activeCenterId: centerId,
    });
    const supPost = await postTelegramLinkRoute(
      new Request("http://localhost/api/account/telegram", { method: "POST" })
    );
    expect(supPost.status).toBe(403);
    expect(supPost.headers.get("cache-control")).toBe("no-store");

    // Student via Mobile Bearer token (clear cookie mock)
    mockToken = "";
    const mobileJwt = await signJWT({
      userId: studentUserId,
      email: studentEmail,
      platformRole: "NONE",
      activeCenterId: centerId,
    });
    const linkRes = await postTelegramLinkRoute(
      new Request("http://localhost/api/account/telegram", {
        method: "POST",
        headers: { Authorization: `Bearer ${mobileJwt}` },
      })
    );
    expect(linkRes.status).toBe(200);
    expect(linkRes.headers.get("cache-control")).toBe("no-store");
    const linkJson = await linkRes.json();
    expect(linkJson.token).toBeTruthy();

    // Ensure raw token is NOT stored in DB
    const dbTokens = await db.telegramLinkToken.findMany({ where: { userId: studentUserId } });
    expect(dbTokens.some((t) => t.tokenHash === linkJson.token)).toBe(false);
    expect(dbTokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);

    // Reuse & collision checks
    const chatId = `9900${String(ts).slice(-5)}`;
    const firstConsume = await consumeTelegramLinkToken({
      rawToken: linkJson.token,
      telegramId: chatId,
      chatId,
      username: "dilshod_stu",
    });
    expect(firstConsume.ok).toBe(true);

    // Second consume of SAME token fails
    const reuseConsume = await consumeTelegramLinkToken({
      rawToken: linkJson.token,
      telegramId: chatId,
      chatId,
    });
    expect(reuseConsume.ok).toBe(false);
    if (!reuseConsume.ok) {
      expect(reuseConsume.reason).toBe("TOKEN_INVALID_OR_EXPIRED");
    }

    // Other user trying to bind SAME chatId is blocked
    const secondUserTok = await createTelegramLinkToken(secondStudentUserId);
    const collisionConsume = await consumeTelegramLinkToken({
      rawToken: secondUserTok.token,
      telegramId: chatId,
      chatId,
    });
    expect(collisionConsume.ok).toBe(false);
    if (!collisionConsume.ok) {
      expect(collisionConsume.reason).toBe("CHAT_ALREADY_LINKED_TO_OTHER_USER");
    }

    // Expired token rejected
    const expiredTok = await createTelegramLinkToken(secondStudentUserId, {
      now: new Date(Date.now() - 60 * 60 * 1000),
    });
    const expiredRes = await consumeTelegramLinkToken({
      rawToken: expiredTok.token,
      telegramId: `777${String(ts).slice(-5)}`,
      chatId: `777${String(ts).slice(-5)}`,
    });
    expect(expiredRes.ok).toBe(false);

    // GET & DELETE account status via Bearer
    const getRes = await getTelegramAccountRoute(
      new Request("http://localhost/api/account/telegram", {
        headers: { Authorization: `Bearer ${mobileJwt}` },
      })
    );
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.linked).toBe(true);
    expect(getJson.account.username).toBe("dilshod_stu");

    const delRes = await deleteTelegramAccountRoute(
      new Request("http://localhost/api/account/telegram", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${mobileJwt}` },
      })
    );
    expect(delRes.status).toBe(200);
    const delJson = await delRes.json();
    expect(delJson.unlinked).toBe(true);
  });

  it("handles group rejection, /start, /balance (with Click link & confirmed children only), /schedule, /payments, /lang, /stop", async () => {
    const replies: Array<{ chatId: string; text: string; url?: string }> = [];
    const spyTransport: TelegramTransportFn = async (p) => {
      const firstBtn = p.replyMarkup?.inline_keyboard?.[0]?.[0];
      const url = firstBtn && "url" in firstBtn ? firstBtn.url : undefined;
      replies.push({
        chatId: p.chatId,
        text: p.text,
        url,
      });
      return { messageId: String(replies.length) };
    };

    // Group chat refused
    await processTelegramUpdate(tgMessageUpdate(1001, -55555, 88801, "/balance", "group"), {
      transport: spyTransport,
    });
    expect(replies[replies.length - 1]?.text).toContain("в личном чате");

    // Link Parent via /start <token>
    const parTok = await createTelegramLinkToken(parentUserId);
    const parentTgChat = Number(`44${String(ts).slice(-6)}`);
    await processTelegramUpdate(
      tgMessageUpdate(1002, parentTgChat, parentTgChat, `/start ${parTok.token}`),
      { transport: spyTransport }
    );
    expect(replies[replies.length - 1]?.text).toContain("Madina Parent");

    // Parent /balance shows ONLY confirmed child Dilshod Student, NEVER Unconfirmed Child, and includes Click pay URL
    await processTelegramUpdate(tgMessageUpdate(1003, parentTgChat, parentTgChat, "/balance"), {
      transport: spyTransport,
    });
    const balReply = replies[replies.length - 1]!;
    expect(balReply.text).toContain("Dilshod Student");
    expect(balReply.text).toContain("400 000");
    expect(balReply.text).not.toContain("Unconfirmed Child");
    expect(balReply.url).toContain("click.uz");

    // Parent /schedule shows Dilshod Student schedule B2-Morning
    await processTelegramUpdate(tgMessageUpdate(1004, parentTgChat, parentTgChat, "/schedule"), {
      transport: spyTransport,
    });
    expect(replies[replies.length - 1]?.text).toContain("B2-Morning");
    expect(replies[replies.length - 1]?.text).not.toContain("Unconfirmed Child");

    // /lang toggles RU -> UZ
    await processTelegramUpdate(tgMessageUpdate(1005, parentTgChat, parentTgChat, "/lang"), {
      transport: spyTransport,
    });
    expect(replies[replies.length - 1]?.text).toContain("o'zbek");

    const updatedParent = await db.platformUser.findUnique({ where: { id: parentUserId } });
    expect(updatedParent?.preferredLanguage).toBe("uz_Latn");

    // /payments works cleanly
    await processTelegramUpdate(tgMessageUpdate(1006, parentTgChat, parentTgChat, "/payments"), {
      transport: spyTransport,
    });
    expect(replies[replies.length - 1]).toBeTruthy();

    // /stop unlinks parent
    await processTelegramUpdate(tgMessageUpdate(1007, parentTgChat, parentTgChat, "/stop"), {
      transport: spyTransport,
    });
    expect(replies[replies.length - 1]?.text).toContain("uzildi");

    const linkAfterStop = await db.telegramAccount.findUnique({ where: { userId: parentUserId } });
    expect(linkAfterStop).toBeNull();
  });

  it("auto-marks TelegramAccount isBlocked=true when Telegram API returns 403 bot blocked", async () => {
    const tok = await createTelegramLinkToken(studentUserId);
    const blockedChatId = `55${String(ts).slice(-6)}`;
    await consumeTelegramLinkToken({
      rawToken: tok.token,
      telegramId: blockedChatId,
      chatId: blockedChatId,
    });

    const res = await sendTelegramToUser({
      userId: studentUserId,
      centerId,
      text: "Reminder",
      type: "PAYMENT_DUE",
      eventKey: `tg_blk_${ts}`,
      transport: async () => {
        throw { error_code: 403, description: "Forbidden: bot was blocked by the user" };
      },
    });

    expect(res.sent).toBe(false);
    expect(res.reason).toBe("USER_BLOCKED_BOT");

    const acct = await db.telegramAccount.findUnique({ where: { userId: studentUserId } });
    expect(acct?.isBlocked).toBe(true);
    expect(acct?.isActive).toBe(false);
  });
});
