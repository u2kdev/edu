import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function getTestDbUrl() {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL or DATABASE_URL_TEST is required");
  return base.replace(/\/([^/?]+)(\?.*)?$/, "/lms_test$2");
}

const TEST_DB_URL = getTestDbUrl();
process.env.DATABASE_URL = TEST_DB_URL;

const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

const PANEL_THEME_COOKIE = "edarschi_panel_theme";
const PANEL_RESOLVED_COOKIE = "edarschi_panel_resolved_theme";

function findBrowser() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Neither Google Chrome nor Microsoft Edge binary was found");
}

async function isServerReady(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/login`, {
      signal: AbortSignal.timeout(4000),
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function startNextServer(port) {
  const forceDev = process.argv.includes("--dev");
  const hasProdBuild = fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"));
  const useProdStart = !forceDev && hasProdBuild;
  const subCmd = useProdStart ? "start" : "dev";

  console.log(
    `Starting isolated Next.js (${subCmd}) server on port ${port} (DB: lms_test)...`
  );
  const proc = spawn(
    "cmd.exe",
    ["/c", "npx", "next", subCmd, "-H", "127.0.0.1", "-p", String(port)],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: useProdStart ? "production" : "development",
        NODE_OPTIONS: "--dns-result-order=ipv4first",
        DATABASE_URL: TEST_DB_URL,
        DIRECT_URL: TEST_DB_URL,
      },
    }
  );

  proc.stdout.on("data", (chunk) => {
    const s = chunk.toString().trim();
    if (s) console.log(`[next-${subCmd}] ${s}`);
  });
  proc.stderr.on("data", (chunk) => {
    const s = chunk.toString().trim();
    if (s) console.error(`[next-${subCmd}:err] ${s}`);
  });

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await isServerReady(port)) {
      console.log(`Next.js (${subCmd}) server ready on port ${port}`);
      return proc;
    }
  }
  if (proc.pid) {
    spawnSync("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { stdio: "ignore" });
  }
  throw new Error(`Timed out waiting for Next.js (${subCmd}) server on port ${port}`);
}

async function createSessionToken(user, extraClaims = {}) {
  const jti = crypto.randomUUID();
  const jtiHash = crypto.createHash("sha256").update(jti).digest("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      jtiHash,
      expiresAt,
      ipAddress: "127.0.0.1",
      userAgent: "Stage3AuditRunner",
    },
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be configured (>= 32 chars)");
  }

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      ...extraClaims,
    },
    jwtSecret,
    { expiresIn: "2h", jwtid: jti }
  );
}

async function connectCDP(port) {
  let ok = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        ok = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!ok) throw new Error(`CDP endpoint on port ${port} unreachable`);

  const tabRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  const target = await tabRes.json();
  const browserErrors = [];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let seq = 1;
  const pending = new Map();

  const rejectAll = (reason) => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(reason);
    }
    pending.clear();
  };

  ws.onclose = () => rejectAll(new Error("CDP WebSocket closed unexpectedly"));
  ws.onerror = () => rejectAll(new Error("CDP WebSocket error"));

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.method === "Runtime.exceptionThrown") {
      browserErrors.push(
        data.params?.exceptionDetails?.exception?.description ||
          data.params?.exceptionDetails?.text ||
          "Runtime exception"
      );
    } else if (data.method === "Log.entryAdded" && data.params?.entry?.level === "error") {
      browserErrors.push(`${data.params.entry.source}: ${data.params.entry.text}`);
    } else if (data.method === "Runtime.consoleAPICalled" && data.params?.type === "error") {
      browserErrors.push(
        data.params.args?.map((a) => a.value || a.description || "").join(" ") || "console.error"
      );
    } else if (data.method === "Inspector.targetCrashed") {
      rejectAll(new Error("Browser target crashed"));
    }
    if (data.id && pending.has(data.id)) {
      const { resolve, reject, timer } = pending.get(data.id);
      clearTimeout(timer);
      pending.delete(data.id);
      if (data.error) reject(new Error(data.error.message));
      else resolve(data.result);
    }
  };

  const send = (method, params = {}, timeoutMs = 25000) =>
    new Promise((resolve, reject) => {
      if (ws.readyState !== WebSocket.OPEN) {
        reject(new Error(`CDP socket not open when calling ${method}`));
        return;
      }
      const id = seq++;
      const timer = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`CDP timeout after ${timeoutMs}ms calling ${method}`));
        }
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });

  return { ws, send, browserErrors };
}

async function setCookie(send, name, value, httpOnly = false) {
  await send("Network.setCookie", {
    name,
    value,
    domain: "127.0.0.1",
    path: "/",
    httpOnly,
    sameSite: "Lax",
  });
}

async function evalJS(send, expression, timeoutMs = 25000) {
  const res = await send(
    "Runtime.evaluate",
    {
      expression,
      awaitPromise: true,
      returnByValue: true,
    },
    timeoutMs
  );
  if (res.exceptionDetails) {
    throw new Error(
      `Browser JS error: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`
    );
  }
  return res.result?.value;
}

async function cleanupOrphanedStage3Data() {
  const oldCenters = await prisma.learningCenter.findMany({
    where: {
      OR: [
        { slug: { startsWith: "bright-ui3_" } },
        { slug: { startsWith: "samarkand-ui3_" } },
      ],
    },
    select: { id: true },
  });
  const centerIds = oldCenters.map((c) => c.id);
  const oldUsers = await prisma.platformUser.findMany({
    where: { email: { contains: ".ui3_", endsWith: "@edarschi.test" } },
    select: { id: true },
  });
  const userIds = oldUsers.map((u) => u.id);
  const oldPlans = await prisma.subscriptionPlan.findMany({
    where: { name: { startsWith: "Business ui3_" } },
    select: { id: true },
  });
  const planIds = oldPlans.map((p) => p.id);

  if (centerIds.length > 0) {
    await prisma.financeTransaction.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.attendance.deleteMany({ where: { lesson: { centerId: { in: centerIds } } } }).catch(() => {});
    await prisma.grade.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.homeworkSubmission.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.charge.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.centerPayment.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.platformPayment.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.parentLink.deleteMany({
      where: { OR: [{ parent: { centerId: { in: centerIds } } }, { student: { centerId: { in: centerIds } } }] },
    }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.scheduleSlot.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.group.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.course.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.account.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.financeCategory.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.learningCenter.deleteMany({ where: { id: { in: centerIds } } }).catch(() => {});
  }
  if (planIds.length > 0) {
    await prisma.subscriptionPlan.deleteMany({ where: { id: { in: planIds } } }).catch(() => {});
  }
  if (userIds.length > 0) {
    await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    await prisma.platformUser.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  }
}

async function seedStage3Fixture() {
  const ts = Date.now();
  const suffix = `ui3_${ts}`;
  const fakeHash = "$2a$10$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ012";
  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 86400 * 1000);
  const daysAhead = (d) => new Date(now.getTime() + d * 86400 * 1000);

  const mkUser = (key, fullName, platformRole = "NONE") =>
    prisma.platformUser.create({
      data: {
        email: `${key}.${suffix}@edarschi.test`,
        fullName,
        passwordHash: fakeHash,
        platformRole,
        preferredLanguage: "ru",
        isActive: true,
        emailVerified: now,
        lastLoginAt: now,
      },
    });

  const superadmin = await mkUser("superadmin", "Азиз Суперадмин", "SUPERADMIN");
  const director = await mkUser("director", "Камола Директор");
  const accountant = await mkUser("accountant", "Дильноза Бухгалтер");
  const teacher = await mkUser("teacher", "Сардор Преподаватель");
  const student1 = await mkUser("student1", "Алишер Каримов");
  const student2 = await mkUser("student2", "Нигора Рахимова");
  const student3 = await mkUser("student3", "Жасур Умаров");
  const parent = await mkUser("parent", "Шахло Каримова");

  const planPro = await prisma.subscriptionPlan.create({
    data: {
      name: `Business ${suffix}`,
      priceMonthly: 1_200_000,
      maxStudents: 200,
      maxTeachers: 30,
      maxCourses: 25,
      featuresJson: JSON.stringify({
        onlinePaymentsClick: true,
        telegramBot: true,
        smsReminders: true,
        broadcasts: true,
        advancedReports: true,
        mobileApp: true,
        pdfReceipts: true,
        promoCodes: true,
        financeAccounting: true,
      }),
    },
  });

  const center1 = await prisma.learningCenter.create({
    data: {
      name: "Bright Future Academy",
      slug: `bright-${suffix}`,
      status: "ACTIVE",
      ownerId: director.id,
    },
  });
  const center2 = await prisma.learningCenter.create({
    data: {
      name: "Samarkand Tech Hub",
      slug: `samarkand-${suffix}`,
      status: "TRIAL",
      ownerId: director.id,
    },
  });

  const sub1 = await prisma.subscription.create({
    data: {
      centerId: center1.id,
      planId: planPro.id,
      status: "ACTIVE",
      currentPeriodStartsAt: daysAgo(15),
      currentPeriodEndsAt: daysAhead(15),
    },
  });
  await prisma.subscription.create({
    data: {
      centerId: center2.id,
      planId: planPro.id,
      status: "TRIAL",
      trialEndsAt: daysAhead(5),
      currentPeriodStartsAt: daysAgo(9),
      currentPeriodEndsAt: daysAhead(5),
    },
  });

  for (let m = 0; m < 4; m++) {
    await prisma.platformPayment.create({
      data: {
        centerId: center1.id,
        subscriptionId: sub1.id,
        planId: planPro.id,
        amount: 1_200_000 + m * 300_000,
        currency: "UZS",
        status: "PAID",
        paymentType: "SUBSCRIPTION",
        paidAt: daysAgo(m * 30 + 2),
      },
    });
  }

  const mkMem = (userId, centerId, role) =>
    prisma.centerMembership.create({
      data: { userId, centerId, role, status: "ACTIVE" },
    });

  const dirMem = await mkMem(director.id, center1.id, "DIRECTOR");
  await mkMem(director.id, center2.id, "DIRECTOR");
  await mkMem(accountant.id, center1.id, "ACCOUNTANT");
  const teachMem = await mkMem(teacher.id, center1.id, "TEACHER");
  const stuMem1 = await mkMem(student1.id, center1.id, "STUDENT");
  const stuMem2 = await mkMem(student2.id, center1.id, "STUDENT");
  const stuMem3 = await mkMem(student3.id, center1.id, "STUDENT");
  const parentMem = await mkMem(parent.id, center1.id, "PARENT");

  await prisma.parentLink.createMany({
    data: [
      { parentMembershipId: parentMem.id, studentMembershipId: stuMem1.id, status: "CONFIRMED" },
      { parentMembershipId: parentMem.id, studentMembershipId: stuMem2.id, status: "CONFIRMED" },
    ],
  });

  const cashAcc = await prisma.account.create({
    data: { centerId: center1.id, name: "Основная касса", type: "CASH", isDefault: true },
  });
  const bankAcc = await prisma.account.create({
    data: { centerId: center1.id, name: "Расчётный счёт Click", type: "BANK", isDefault: false },
  });
  const expRent = await prisma.financeCategory.create({
    data: { centerId: center1.id, name: "Аренда помещений", type: "EXPENSE" },
  });
  const expMkt = await prisma.financeCategory.create({
    data: { centerId: center1.id, name: "Маркетинг", type: "EXPENSE" },
  });

  const courseEng = await prisma.course.create({
    data: {
      centerId: center1.id,
      title: "IELTS Intensive",
      priceMonthly: 850_000,
      isPublished: true,
      createdByMembershipId: dirMem.id,
    },
  });
  const courseIt = await prisma.course.create({
    data: {
      centerId: center1.id,
      title: "Frontend React",
      priceMonthly: 1_100_000,
      isPublished: true,
      createdByMembershipId: dirMem.id,
    },
  });

  const modEng = await prisma.courseModule.create({
    data: { centerId: center1.id, courseId: courseEng.id, title: "Speaking & Writing" },
  });
  const modIt = await prisma.courseModule.create({
    data: { centerId: center1.id, courseId: courseIt.id, title: "Hooks & State" },
  });

  const groupEng = await prisma.group.create({
    data: {
      centerId: center1.id,
      courseId: courseEng.id,
      name: "IELTS Morning A1",
      teacherMembershipId: teachMem.id,
      maxStudents: 15,
    },
  });
  const groupIt = await prisma.group.create({
    data: {
      centerId: center1.id,
      courseId: courseIt.id,
      name: "React Evening B2",
      teacherMembershipId: teachMem.id,
      maxStudents: 16,
    },
  });

  const enr1 = await prisma.enrollment.create({
    data: { centerId: center1.id, studentMembershipId: stuMem1.id, groupId: groupEng.id, paidUntil: daysAhead(12) },
  });
  await prisma.enrollment.create({
    data: { centerId: center1.id, studentMembershipId: stuMem1.id, groupId: groupIt.id, paidUntil: daysAhead(4) },
  });
  await prisma.enrollment.create({
    data: { centerId: center1.id, studentMembershipId: stuMem2.id, groupId: groupEng.id, paidUntil: daysAhead(20) },
  });
  await prisma.enrollment.create({
    data: { centerId: center1.id, studentMembershipId: stuMem3.id, groupId: groupEng.id, paidUntil: daysAhead(20) },
  });

  const isoToday = (() => {
    const d = new Date(now.getTime() + 5 * 3600 * 1000).getUTCDay();
    return d === 0 ? 7 : d;
  })();

  await prisma.scheduleSlot.createMany({
    data: [
      {
        centerId: center1.id,
        groupId: groupEng.id,
        teacherMembershipId: teachMem.id,
        dayOfWeek: isoToday,
        startTime: "10:00",
        endTime: "11:30",
        roomName: "A201",
      },
      {
        centerId: center1.id,
        groupId: groupIt.id,
        teacherMembershipId: teachMem.id,
        dayOfWeek: ((isoToday % 7) + 1),
        startTime: "18:30",
        endTime: "20:00",
        roomName: "Lab-2",
      },
    ],
  });

  const lessonsEng = [];
  for (let i = 0; i < 6; i++) {
    const isFuture = i >= 4;
    const l = await prisma.lesson.create({
      data: {
        centerId: center1.id,
        moduleId: modEng.id,
        title: `IELTS Lesson ${i + 1}`,
        scheduledAt: isFuture ? daysAhead((i - 3) * 3) : daysAgo((4 - i) * 4),
        durationMinutes: 90,
      },
    });
    lessonsEng.push(l);
  }
  await prisma.lesson.create({
    data: {
      centerId: center1.id,
      moduleId: modIt.id,
      title: "React Context & Query",
      scheduledAt: daysAgo(2),
      durationMinutes: 90,
    },
  });

  await prisma.attendance.createMany({
    data: [
      { lessonId: lessonsEng[0].id, studentMembershipId: stuMem1.id, groupId: groupEng.id, status: "PRESENT", markedByMembershipId: teachMem.id, markedAt: daysAgo(12) },
      { lessonId: lessonsEng[1].id, studentMembershipId: stuMem1.id, groupId: groupEng.id, status: "LATE", markedByMembershipId: teachMem.id, markedAt: daysAgo(8) },
      { lessonId: lessonsEng[2].id, studentMembershipId: stuMem1.id, groupId: groupEng.id, status: "PRESENT", markedByMembershipId: teachMem.id, markedAt: daysAgo(5) },
      { lessonId: lessonsEng[3].id, studentMembershipId: stuMem1.id, groupId: groupEng.id, status: "ABSENT", markedByMembershipId: teachMem.id, markedAt: daysAgo(2) },
      { lessonId: lessonsEng[0].id, studentMembershipId: stuMem2.id, groupId: groupEng.id, status: "ABSENT", markedByMembershipId: teachMem.id, markedAt: daysAgo(12) },
      { lessonId: lessonsEng[1].id, studentMembershipId: stuMem2.id, groupId: groupEng.id, status: "ABSENT", markedByMembershipId: teachMem.id, markedAt: daysAgo(8) },
      { lessonId: lessonsEng[2].id, studentMembershipId: stuMem2.id, groupId: groupEng.id, status: "PRESENT", markedByMembershipId: teachMem.id, markedAt: daysAgo(5) },
    ],
  });

  const hw1 = await prisma.homework.create({
    data: { centerId: center1.id, lessonId: lessonsEng[1].id, title: "Essay Task 2", dueDate: daysAgo(5) },
  });
  const hw2 = await prisma.homework.create({
    data: { centerId: center1.id, lessonId: lessonsEng[2].id, title: "Listening Summary", dueDate: daysAgo(1) },
  });
  await prisma.homeworkSubmission.createMany({
    data: [
      { centerId: center1.id, homeworkId: hw1.id, studentMembershipId: stuMem1.id, groupId: groupEng.id, status: "ACCEPTED", grade: 88, submittedAt: daysAgo(6), gradedAt: daysAgo(5) },
      { centerId: center1.id, homeworkId: hw2.id, studentMembershipId: stuMem1.id, groupId: groupEng.id, status: "UNDER_REVIEW", submittedAt: now },
      { centerId: center1.id, homeworkId: hw2.id, studentMembershipId: stuMem2.id, groupId: groupEng.id, status: "SUBMITTED", submittedAt: daysAgo(1) },
    ],
  });

  await prisma.grade.createMany({
    data: [
      { centerId: center1.id, studentMembershipId: stuMem1.id, groupId: groupEng.id, lessonId: lessonsEng[0].id, teacherMembershipId: teachMem.id, value: 84, maxValue: 100, createdAt: daysAgo(10) },
      { centerId: center1.id, studentMembershipId: stuMem1.id, groupId: groupEng.id, lessonId: lessonsEng[1].id, teacherMembershipId: teachMem.id, value: 91, maxValue: 100, createdAt: daysAgo(5) },
      { centerId: center1.id, studentMembershipId: stuMem2.id, groupId: groupEng.id, lessonId: lessonsEng[0].id, teacherMembershipId: teachMem.id, value: 74, maxValue: 100, createdAt: daysAgo(10) },
      { centerId: center1.id, studentMembershipId: stuMem2.id, groupId: groupEng.id, lessonId: lessonsEng[1].id, teacherMembershipId: teachMem.id, value: 78, maxValue: 100, createdAt: daysAgo(5) },
      { centerId: center1.id, studentMembershipId: stuMem3.id, groupId: groupEng.id, lessonId: lessonsEng[0].id, teacherMembershipId: teachMem.id, value: 80, maxValue: 100, createdAt: daysAgo(10) },
      { centerId: center1.id, studentMembershipId: stuMem3.id, groupId: groupEng.id, lessonId: lessonsEng[1].id, teacherMembershipId: teachMem.id, value: 85, maxValue: 100, createdAt: daysAgo(5) },
    ],
  });

  const pay1 = await prisma.centerPayment.create({
    data: {
      centerId: center1.id,
      studentMembershipId: stuMem1.id,
      groupId: groupEng.id,
      amount: 1_700_000,
      originalAmount: 1_900_000,
      discountAmount: 200_000,
      status: "PAID",
      paymentMethod: "ONLINE",
      externalTxId: `clk_ui3_${ts}_1`,
      receiptNumber: `RC-${ts}-1`,
      paidAt: daysAgo(3),
    },
  });
  const pay2 = await prisma.centerPayment.create({
    data: {
      centerId: center1.id,
      studentMembershipId: stuMem2.id,
      groupId: groupIt.id,
      amount: 1_100_000,
      status: "PAID",
      paymentMethod: "CASH",
      receiptNumber: `RC-${ts}-2`,
      paidAt: daysAgo(1),
    },
  });
  const pay3 = await prisma.centerPayment.create({
    data: {
      centerId: center1.id,
      studentMembershipId: stuMem3.id,
      groupId: groupEng.id,
      amount: 850_000,
      status: "PAID",
      paymentMethod: "BANK_TRANSFER",
      receiptNumber: `RC-${ts}-3`,
      paidAt: daysAgo(32),
    },
  });
  await prisma.centerPayment.create({
    data: {
      centerId: center1.id,
      studentMembershipId: stuMem3.id,
      groupId: groupEng.id,
      amount: 425_000,
      refundedAmount: 425_000,
      manualRefundStatus: "PENDING_MANUAL",
      status: "REFUNDED",
      paymentMethod: "ONLINE",
      receiptNumber: `CLK-${ts}-RF`,
      paidAt: daysAgo(6),
      refundedAt: daysAgo(1),
    },
  });

  await prisma.financeTransaction.createMany({
    data: [
      { centerId: center1.id, type: "INCOME", amount: 1_700_000, accountId: bankAcc.id, centerPaymentId: pay1.id, studentMembershipId: stuMem1.id, groupId: groupEng.id, courseId: courseEng.id, date: daysAgo(3), createdBy: director.id },
      { centerId: center1.id, type: "INCOME", amount: 1_100_000, accountId: cashAcc.id, centerPaymentId: pay2.id, studentMembershipId: stuMem2.id, groupId: groupIt.id, courseId: courseIt.id, date: daysAgo(1), createdBy: director.id },
      { centerId: center1.id, type: "INCOME", amount: 850_000, accountId: bankAcc.id, centerPaymentId: pay3.id, studentMembershipId: stuMem3.id, groupId: groupEng.id, courseId: courseEng.id, date: daysAgo(32), createdBy: director.id },
      { centerId: center1.id, type: "EXPENSE", amount: 900_000, accountId: cashAcc.id, categoryId: expRent.id, date: daysAgo(4), description: "Аренда зала", createdBy: accountant.id },
      { centerId: center1.id, type: "EXPENSE", amount: 450_000, accountId: bankAcc.id, categoryId: expMkt.id, date: daysAgo(2), description: "Таргет", createdBy: accountant.id },
    ],
  });

  await prisma.charge.create({
    data: {
      centerId: center1.id,
      enrollmentId: enr1.id,
      studentMembershipId: stuMem1.id,
      groupId: groupEng.id,
      invoiceNumber: `INV-UI3-${ts}`,
      periodMonths: 1,
      periodStart: daysAgo(70),
      periodEnd: daysAgo(40),
      originalAmount: 850_000,
      discountAmount: 0,
      amount: 850_000,
      paidAmount: 400_000,
      status: "PARTIAL",
      dueDate: daysAgo(40),
    },
  });

  return {
    center1,
    center2,
    planPro,
    users: [superadmin, director, accountant, teacher, student1, student2, student3, parent],
    screens: [
      { key: "superadmin", user: superadmin, path: "/platform-admin" },
      { key: "director", user: director, path: "/center", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "accountant-finance", user: accountant, path: "/center/finance", centerId: center1.id, centerRole: "ACCOUNTANT" },
      { key: "accountant-reports", user: accountant, path: "/center/reports", centerId: center1.id, centerRole: "ACCOUNTANT" },
      { key: "teacher", user: teacher, path: "/center", centerId: center1.id, centerRole: "TEACHER" },
      { key: "student", user: student1, path: "/center", centerId: center1.id, centerRole: "STUDENT" },
      { key: "student-grades", user: student1, path: "/center/grades", centerId: center1.id, centerRole: "STUDENT" },
      { key: "parent", user: parent, path: "/center", centerId: center1.id, centerRole: "PARENT" },
      {
        key: "student-profile",
        user: director,
        path: `/center/students/${stuMem1.id}`,
        centerId: center1.id,
        centerRole: "DIRECTOR",
        clickTabText: "Успеваемость",
      },
    ],
  };
}

async function cleanupFixture(fixture) {
  if (!fixture) return;
  const userIds = fixture.users.map((u) => u.id);
  const centerIds = [fixture.center1.id, fixture.center2.id];
  await prisma.financeTransaction.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.attendance.deleteMany({ where: { lesson: { centerId: { in: centerIds } } } }).catch(() => {});
  await prisma.grade.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.homeworkSubmission.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.charge.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.centerPayment.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.platformPayment.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.parentLink.deleteMany({
    where: { OR: [{ parent: { centerId: { in: centerIds } } }, { student: { centerId: { in: centerIds } } }] },
  }).catch(() => {});
  await prisma.enrollment.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.scheduleSlot.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.group.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.course.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.account.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.financeCategory.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.subscription.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
  await prisma.learningCenter.deleteMany({ where: { id: { in: centerIds } } }).catch(() => {});
  await prisma.subscriptionPlan.deleteMany({ where: { id: fixture.planPro.id } }).catch(() => {});
  await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
  await prisma.platformUser.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
}

async function main() {
  const outDir = path.join(process.cwd(), "docs", "ui", "stage-3");
  fs.mkdirSync(outDir, { recursive: true });
  const reportsDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");
  const axeSource = fs.readFileSync(axePath, "utf8");

  const port = 3013;
  const cdpPort = 9231;
  let fixture = null;
  let serverProc = null;
  let browserProc = null;
  let tmpProfile = null;

  try {
    await cleanupOrphanedStage3Data();
    fixture = await seedStage3Fixture();
    const tokens = new Map();
    for (const s of fixture.screens) {
      if (!tokens.has(`${s.key}:${s.user.id}`)) {
        const claims = s.centerId
          ? { activeCenterId: s.centerId, activeCenterRole: s.centerRole }
          : {};
        tokens.set(`${s.key}:${s.user.id}`, await createSessionToken(s.user, claims));
      }
    }

    serverProc = await startNextServer(port);
    const browserPath = findBrowser();
    console.log(`Launching headless browser: ${browserPath}`);
    tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), "edarschi-ui3-"));
    browserProc = spawn(browserPath, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      `--remote-debugging-port=${cdpPort}`,
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${tmpProfile}`,
      "about:blank",
    ]);

    const { ws, send, browserErrors } = await connectCDP(cdpPort);
    await send("Page.enable");
    await send("Network.enable");
    await send("Runtime.enable");
    await send("Log.enable");

    const themes = ["light", "dark"];
    const viewports = [
      { key: "1440", width: 1440, height: 900 },
      { key: "390", width: 390, height: 844 },
    ];

    const report = [];

    for (const s of fixture.screens) {
      const token = tokens.get(`${s.key}:${s.user.id}`);
      const url = `http://127.0.0.1:${port}${s.path}`;

      for (const theme of themes) {
        for (const vp of viewports) {
          const shotName = `${s.key}-${theme}-${vp.key}`;
          process.stdout.write(`[${shotName}] nav... `);
          await setCookie(send, PANEL_THEME_COOKIE, theme, false);
          await setCookie(send, PANEL_RESOLVED_COOKIE, theme, false);
          await setCookie(send, "auth_token", token, true);

          await send("Emulation.setDeviceMetricsOverride", {
            width: vp.width,
            height: vp.height,
            deviceScaleFactor: 1,
            mobile: vp.width < 768,
          });

          browserErrors.length = 0;
          await send("Page.navigate", { url });
          for (let w = 0; w < 60; w++) {
            await new Promise((res) => setTimeout(res, 400));
            const ready = await evalJS(
              send,
              `document.readyState === "complete" && document.body && document.body.innerText.trim().length > 0 && location.pathname === ${JSON.stringify(s.path)} && !document.querySelector('[aria-busy="true"]')`,
              10000
            ).catch(() => false);
            if (ready) break;
          }

          if (s.clickTabText) {
            await evalJS(
              send,
              `(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const target = btns.find((b) => (b.textContent || '').includes(${JSON.stringify(s.clickTabText)}));
                if (target) target.click();
              })()`,
              10000
            );
          }
          await new Promise((res) => setTimeout(res, 750));

          const metrics = await evalJS(
            send,
            `(() => {
              const svgCharts = document.querySelectorAll('.recharts-responsive-container svg, svg.recharts-surface').length;
              return {
                pathname: location.pathname,
                scrollWidth: document.documentElement.scrollWidth,
                innerWidth: window.innerWidth,
                hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
                htmlDark: document.documentElement.classList.contains('dark'),
                svgCharts,
              };
            })()`,
            10000
          );

          process.stdout.write(`axe... `);
          await evalJS(send, axeSource, 20000);
          const axe = await evalJS(
            send,
            `(async () => {
              const r = await axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] }
              });
              return {
                violations: r.violations.map((v) => ({
                  id: v.id,
                  impact: v.impact,
                  nodesCount: v.nodes.length,
                  targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
                })),
                passesCount: r.passes.length,
              };
            })()`,
            25000
          );

          process.stdout.write(`shot... `);
          const shot = await send("Page.captureScreenshot", { format: "png" }, 20000);
          fs.writeFileSync(path.join(outDir, `${shotName}.png`), Buffer.from(shot.data, "base64"));

          const relevantErrors = browserErrors.filter(
            (e) => !e.includes("favicon.ico") && !e.includes("404 (Not Found)")
          );

          report.push({
            name: shotName,
            screen: s.key,
            theme,
            viewport: `${vp.width}x${vp.height}`,
            ...metrics,
            axeViolations: axe.violations.length,
            axeDetails: axe.violations,
            axePasses: axe.passesCount,
            browserErrors: relevantErrors,
          });

          console.log(
            `done! path=${metrics.pathname} charts=${metrics.svgCharts} overflow=${metrics.hasHorizontalOverflow} axe=${axe.violations.length} errs=${relevantErrors.length}`
          );
        }
      }
    }

    const reportPath = path.join(reportsDir, "stage3-audit.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), results: report }, null, 2)
    );
    console.log(`Stage 3 screenshot & audit report saved to ${reportPath}`);
    ws.close();
  } finally {
    if (browserProc && browserProc.pid) {
      try {
        spawnSync("taskkill", ["/pid", String(browserProc.pid), "/t", "/f"], { stdio: "ignore" });
      } catch {}
    }
    if (tmpProfile) {
      try {
        fs.rmSync(tmpProfile, { recursive: true, force: true });
      } catch {}
    }
    if (serverProc && serverProc.pid) {
      try {
        spawnSync("taskkill", ["/pid", String(serverProc.pid), "/t", "/f"], { stdio: "ignore" });
      } catch {}
    }
    await cleanupFixture(fixture);
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Stage 3 screenshot runner failed:", err);
  process.exit(1);
});
