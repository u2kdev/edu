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

  console.log(`Starting isolated Next.js (${subCmd}) server on port ${port} (DB: lms_test)...`);
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
  const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000);

  await prisma.userSession.create({
    data: {
      userId: user.id,
      jtiHash,
      expiresAt,
      ipAddress: "127.0.0.1",
      userAgent: "UI5FinalAuditRunner",
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
    { expiresIn: "3h", jwtid: jti }
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

async function cleanupByCenterIds(centerIds, userIds, planIds) {
  if (centerIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.ticketMessage.deleteMany({ where: { ticket: { centerId: { in: centerIds } } } }).catch(() => {});
    await prisma.supportTicket.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.announcement.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.inviteCode.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.promoCode.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.financeTransaction.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.attendance.deleteMany({ where: { lesson: { centerId: { in: centerIds } } } }).catch(() => {});
    await prisma.grade.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.homeworkSubmission.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.homework.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.lesson.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.charge.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.centerPayment.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.platformPayment.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.parentLink.deleteMany({
      where: { OR: [{ parent: { centerId: { in: centerIds } } }, { student: { centerId: { in: centerIds } } }] },
    }).catch(() => {});
    await prisma.enrollment.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.scheduleSlot.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.group.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.courseModule.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.course.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.branch.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.account.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.financeCategory.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.centerMembership.deleteMany({ where: { centerId: { in: centerIds } } }).catch(() => {});
    await prisma.learningCenter.deleteMany({ where: { id: { in: centerIds } } }).catch(() => {});
  }
  if (planIds.length > 0) {
    await prisma.subscriptionPlan.deleteMany({ where: { id: { in: planIds } } }).catch(() => {});
  }
  if (userIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } }).catch(() => {});
    await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } }).catch(() => {});
    await prisma.platformUser.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  }
}

async function cleanupOrphanedData() {
  const oldCenters = await prisma.learningCenter.findMany({
    where: {
      OR: [
        { slug: { startsWith: "bright-ui5_" } },
        { slug: { startsWith: "samarkand-ui5_" } },
      ],
    },
    select: { id: true },
  });
  const oldUsers = await prisma.platformUser.findMany({
    where: { email: { contains: ".ui5_", endsWith: "@edarschi.test" } },
    select: { id: true },
  });
  const oldPlans = await prisma.subscriptionPlan.findMany({
    where: { name: { startsWith: "Business ui5_" } },
    select: { id: true },
  });
  await cleanupByCenterIds(
    oldCenters.map((c) => c.id),
    oldUsers.map((u) => u.id),
    oldPlans.map((p) => p.id)
  );
}

async function seedFixture() {
  const ts = Date.now();
  const suffix = `ui5_${ts}`;
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
  const developer = await mkUser("developer", "Тимур Разработчик", "DEVELOPER");
  const director = await mkUser("director", "Камола Директор");
  const centerAdmin = await mkUser("cadmin", "Рустам Администратор");
  const accountant = await mkUser("accountant", "Дильноза Бухгалтер");
  const teacher = await mkUser("teacher", "Сардор Преподаватель");
  const assistant = await mkUser("assist", "Мадина Ассистент");
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
      maxBranches: 5,
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
      phone: "+998901234567",
      email: "info@brightfuture.uz",
      address: "г. Ташкент, ул. Амира Темура, 45",
      smsEnabled: true,
      emailEnabled: true,
      paymentReminderEnabled: true,
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
  await mkMem(centerAdmin.id, center1.id, "CENTER_ADMIN");
  await mkMem(accountant.id, center1.id, "ACCOUNTANT");
  const teachMem = await mkMem(teacher.id, center1.id, "TEACHER");
  await mkMem(assistant.id, center1.id, "TEACHER_ASSISTANT");
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

  const branchMain = await prisma.branch.create({
    data: {
      centerId: center1.id,
      name: "Главный кампус",
      address: "ул. Амира Темура, 45",
      phone: "+998711234567",
      email: "main@brightfuture.uz",
      isActive: true,
    },
  });
  await prisma.branch.create({
    data: {
      centerId: center1.id,
      name: "Филиал Чиланзар",
      address: "кв-л 5, д. 12",
      phone: "+998712345678",
      isActive: true,
    },
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
      branchId: branchMain.id,
      name: "IELTS Morning A1",
      teacherMembershipId: teachMem.id,
      maxStudents: 15,
    },
  });
  const groupIt = await prisma.group.create({
    data: {
      centerId: center1.id,
      courseId: courseIt.id,
      branchId: branchMain.id,
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
        branchId: branchMain.id,
        teacherMembershipId: teachMem.id,
        dayOfWeek: isoToday,
        startTime: "10:00",
        endTime: "11:30",
        roomName: "A201",
      },
      {
        centerId: center1.id,
        groupId: groupIt.id,
        branchId: branchMain.id,
        teacherMembershipId: teachMem.id,
        dayOfWeek: (isoToday % 7) + 1,
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
    data: { centerId: center1.id, lessonId: lessonsEng[2].id, title: "Listening Summary", dueDate: daysAhead(2) },
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
      externalTxId: `clk_ui5_${ts}_1`,
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
      invoiceNumber: `INV-UI5-${ts}`,
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

  await prisma.promoCode.create({
    data: {
      centerId: center1.id,
      code: `AUTUMN_${ts}`,
      description: "Скидка 15% на осенний семестр",
      discountType: "PERCENT",
      value: 15,
      isActive: true,
      createdByUserId: director.id,
    },
  });

  await prisma.announcement.createMany({
    data: [
      {
        centerId: center1.id,
        authorId: dirMem.id,
        title: "График занятий на праздничную неделю",
        body: "Все группы занимаются по основному расписанию с переносом утреннего занятия.",
        isPinned: true,
      },
      {
        centerId: center1.id,
        authorId: dirMem.id,
        title: "Открыт пробный экзамен IELTS",
        body: "Запись на субботний mock-test открыта в расписании группы.",
        groupId: groupEng.id,
        isPinned: false,
      },
    ],
  });

  await prisma.supportTicket.create({
    data: {
      centerId: center1.id,
      creatorUserId: director.id,
      subject: "Подключение Click Merchant",
      status: "OPEN",
      priority: "MEDIUM",
      scope: "TENANT",
    },
  });

  await prisma.inviteCode.create({
    data: {
      centerId: center1.id,
      code: `INVUI5_${ts}`,
      targetRole: "STUDENT",
      courseId: courseEng.id,
      groupId: groupEng.id,
      maxUses: 10,
      createdByMembershipId: dirMem.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      centerId: center1.id,
      actorUserId: director.id,
      action: "SETTINGS_UPDATED",
      resource: "LearningCenter",
      resourceId: center1.id,
      ipAddress: "127.0.0.1",
    },
  });

  return {
    center1,
    center2,
    planPro,
    users: [
      superadmin,
      developer,
      director,
      centerAdmin,
      accountant,
      teacher,
      assistant,
      student1,
      student2,
      student3,
      parent,
    ],
    stage4Screens: [
      { key: "director-students", user: director, path: "/center/students", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-student-detail", user: director, path: `/center/students/${stuMem1.id}`, centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-staff", user: director, path: "/center/staff", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-staff-detail", user: director, path: `/center/staff/${teachMem.id}`, centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-groups", user: director, path: "/center/groups", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-payments", user: director, path: "/center/payments", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-communications", user: director, path: "/center/communications", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-settings", user: director, path: "/center/settings", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "superadmin-center-detail", user: superadmin, path: `/platform-admin/centers/${center1.id}` },
    ],
    finalScreens: [
      { key: "superadmin-dashboard", role: "SUPERADMIN", user: superadmin, path: "/platform-admin" },
      { key: "superadmin-centers", role: "SUPERADMIN", user: superadmin, path: "/platform-admin/centers" },
      { key: "superadmin-support", role: "SUPERADMIN", user: superadmin, path: "/platform-admin/support" },
      { key: "director-dashboard", role: "DIRECTOR", user: director, path: "/center", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-finance", role: "DIRECTOR", user: director, path: "/center/finance", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-announcements", role: "DIRECTOR", user: director, path: "/center/announcements", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-branches", role: "DIRECTOR", user: director, path: "/center/branches", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "director-audit", role: "DIRECTOR", user: director, path: "/center/audit", centerId: center1.id, centerRole: "DIRECTOR" },
      { key: "center-admin-dashboard", role: "CENTER_ADMIN", user: centerAdmin, path: "/center", centerId: center1.id, centerRole: "CENTER_ADMIN" },
      { key: "center-admin-schedule", role: "CENTER_ADMIN", user: centerAdmin, path: "/center/schedule", centerId: center1.id, centerRole: "CENTER_ADMIN" },
      { key: "accountant-reports", role: "ACCOUNTANT", user: accountant, path: "/center/reports", centerId: center1.id, centerRole: "ACCOUNTANT" },
      { key: "teacher-dashboard", role: "TEACHER", user: teacher, path: "/center", centerId: center1.id, centerRole: "TEACHER" },
      { key: "teacher-attendance", role: "TEACHER", user: teacher, path: "/center/attendance", centerId: center1.id, centerRole: "TEACHER" },
      { key: "teacher-grades", role: "TEACHER", user: teacher, path: "/center/grades", centerId: center1.id, centerRole: "TEACHER" },
      { key: "teacher-assistant-homework", role: "TEACHER_ASSISTANT", user: assistant, path: "/center/homework", centerId: center1.id, centerRole: "TEACHER_ASSISTANT" },
      { key: "student-dashboard", role: "STUDENT", user: student1, path: "/center", centerId: center1.id, centerRole: "STUDENT" },
      { key: "student-grades", role: "STUDENT", user: student1, path: "/center/grades", centerId: center1.id, centerRole: "STUDENT" },
      { key: "parent-dashboard", role: "PARENT", user: parent, path: "/center", centerId: center1.id, centerRole: "PARENT" },
      { key: "developer-health", role: "DEVELOPER", user: developer, path: "/developer" },
      { key: "account-unified", role: "DIRECTOR", user: director, path: "/account", centerId: center1.id, centerRole: "DIRECTOR" },
    ],
  };
}

async function runSSRChecks(port, directorToken, superadminToken) {
  const ssrThemeResults = [];
  const routes = [
    { path: "/center", token: directorToken },
    { path: "/platform-admin", token: superadminToken },
    { path: "/account", token: directorToken },
  ];

  for (const r of routes) {
    const res = await fetch(`http://127.0.0.1:${port}${r.path}`, {
      headers: {
        Cookie: `auth_token=${r.token}; ${PANEL_THEME_COOKIE}=dark; ${PANEL_RESOLVED_COOKIE}=dark`,
      },
      redirect: "manual",
    });
    const html = await res.text();
    const shellMatch = html.match(/<[^>]*\bpanel-shell\b[^>]*>/i)?.[0] || "";
    const hasDarkClass = /class="[^"]*\bdark\b/i.test(shellMatch);
    const hasDataPanelDark = /data-panel-theme="dark"/i.test(shellMatch);
    const hasNavMarkup = /<nav\b|<aside\b/i.test(html);
    ssrThemeResults.push({
      path: r.path,
      status: res.status,
      hasDarkClass,
      hasDataPanelDark,
      hasNavMarkup,
      noFlashPass: res.status === 200 && hasDarkClass && hasDataPanelDark && hasNavMarkup,
    });
  }
  return ssrThemeResults;
}

async function runNoJSChecks(send, port, directorToken, superadminToken) {
  await send("Emulation.setScriptExecutionDisabled", { value: true });
  const results = [];
  const routes = [
    { path: "/center", token: directorToken },
    { path: "/center/students", token: directorToken },
    { path: "/platform-admin", token: superadminToken },
    { path: "/account", token: directorToken },
  ];

  try {
    for (const r of routes) {
      await setCookie(send, PANEL_THEME_COOKIE, "light", false);
      await setCookie(send, PANEL_RESOLVED_COOKIE, "light", false);
      await setCookie(send, "auth_token", r.token, true);
      await send("Emulation.setDeviceMetricsOverride", {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await send("Page.navigate", { url: `http://127.0.0.1:${port}${r.path}` });
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 200));
        const ok = await evalJS(send, `document.readyState === "complete"`, 5000).catch(() => false);
        if (ok) break;
      }
      const dom = await evalJS(
        send,
        `(() => ({
          pathname: location.pathname,
          h1Count: document.querySelectorAll('h1').length,
          h1Text: document.querySelector('h1')?.textContent?.trim() || '',
          navLinks: document.querySelectorAll('nav a, aside a').length,
          textLen: (() => { const c = document.body.cloneNode(true); c.querySelectorAll('script,style,noscript').forEach((n) => n.remove()); return (c.textContent || '').replace(/\\s+/g, ' ').trim().length; })(),
          hasOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        }))()`,
        8000
      );
      results.push({
        ...dom,
        expectedPath: r.path,
        usableWithoutJS:
          dom.pathname === r.path &&
          dom.h1Count >= 1 &&
          dom.navLinks >= 2 &&
          dom.textLen > 50 &&
          !dom.hasOverflow,
      });
    }
  } finally {
    await send("Emulation.setScriptExecutionDisabled", { value: false });
  }
  return results;
}

async function captureBatch({
  screens,
  outDir,
  dirRel,
  port,
  tokens,
  send,
  browserErrors,
  axeSource,
}) {
  const themes = ["light", "dark"];
  const viewports = [
    { key: "1440", width: 1440, height: 900 },
    { key: "390", width: 390, height: 844 },
  ];
  const results = [];

  for (const s of screens) {
    const token = tokens.get(s.user.id + (s.centerRole ? `:${s.centerRole}` : ""));
    const url = `http://127.0.0.1:${port}${s.path}`;

    for (const theme of themes) {
      for (const vp of viewports) {
        const shotName = `${s.key}-${theme}-${vp.key}`;
        process.stdout.write(`[${dirRel}/${shotName}] `);
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
        for (let w = 0; w < 45; w++) {
          await new Promise((res) => setTimeout(res, 250));
          const ready = await evalJS(
            send,
            `document.readyState === "complete" && document.body && document.body.innerText.trim().length > 0 && location.pathname === ${JSON.stringify(
              s.path
            )} && !document.querySelector('[aria-busy="true"]')`,
            8000
          ).catch(() => false);
          if (ready) break;
        }
        await new Promise((res) => setTimeout(res, 450));

        const metrics = await evalJS(
          send,
          `(() => ({
            pathname: location.pathname,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
            htmlDark: document.documentElement.classList.contains('dark'),
            h1Text: document.querySelector('h1')?.textContent?.trim() || '',
            tableCount: document.querySelectorAll('table').length,
          }))()`,
          8000
        );

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
                targets: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
              })),
              passesCount: r.passes.length,
            };
          })()`,
          25000
        );

        const shot = await send("Page.captureScreenshot", { format: "png" }, 20000);
        fs.writeFileSync(
          path.join(outDir, `${shotName}.png`),
          Buffer.from(shot.data, "base64")
        );

        const relevantErrors = browserErrors.filter(
          (e) => !e.includes("favicon.ico")
        );
        const critOrSerious = axe.violations.filter(
          (v) => v.impact === "critical" || v.impact === "serious"
        );

        results.push({
          stage: dirRel,
          name: shotName,
          role: s.role || null,
          screen: s.key,
          path: metrics.pathname,
          expectedPath: s.path,
          theme,
          viewport: `${vp.width}x${vp.height}`,
          screenshot: `${dirRel}/${shotName}.png`,
          hasHorizontalOverflow: metrics.hasHorizontalOverflow,
          scrollWidth: metrics.scrollWidth,
          innerWidth: metrics.innerWidth,
          htmlDark: metrics.htmlDark,
          axeViolations: axe.violations.length,
          critOrSeriousAxe: critOrSerious.length,
          axeDetails: axe.violations,
          axePasses: axe.passesCount,
          browserErrors: relevantErrors,
        });

        console.log(
          `overflow=${metrics.hasHorizontalOverflow} dark=${metrics.htmlDark} axe=${axe.violations.length} crit=${critOrSerious.length} errs=${relevantErrors.length}`
        );
      }
    }
  }
  return results;
}

function writeFinalIndexMd(finalDir, stage4Results, finalResults, ssrResults, noJsResults) {
  const all = [...stage4Results, ...finalResults];
  const totalShots = all.length;
  const overflowCount = all.filter((r) => r.hasHorizontalOverflow).length;
  const critAxeCount = all.filter((r) => r.critOrSeriousAxe > 0).length;
  const anyAxeCount = all.filter((r) => r.axeViolations > 0).length;
  const errorCount = all.filter((r) => r.browserErrors.length > 0).length;
  const pathMismatch = all.filter((r) => r.path !== r.expectedPath).length;

  const lines = [
    "# Итоговая визуальная и accessibility-приёмка (UI4 + UI5)",
    "",
    `- Дата генерации: ${new Date().toISOString()}`,
    `- Всего скриншотов: **${totalShots}** (Stage 4: ${stage4Results.length}, Final UI5: ${finalResults.length})`,
    `- Горизонтальный скролл (> 1px): **${overflowCount}** нарушений`,
    `- Критические/серьёзные нарушения Axe-Core (WCAG 2.1 AA): **${critAxeCount}** экранов (всего экранов с любыми замечаниями axe: ${anyAxeCount})`,
    `- Ошибки консоли/рантайма в браузере: **${errorCount}** экранов`,
    `- Совпадение ожидаемых маршрутов: ${totalShots - pathMismatch}/${totalShots}`,
    "",
    "## Проверка SSR-темы без вспышки (FOUC)",
    "",
    "| Маршрут | HTTP | `html.dark` | `data-panel-theme=\"dark\"` | `<nav>/<aside>` | Итог |",
    "|---|---:|:---:|:---:|:---:|:---:|",
    ...ssrResults.map(
      (s) =>
        `| \`${s.path}\` | ${s.status} | ${s.hasDarkClass ? "да" : "нет"} | ${s.hasDataPanelDark ? "да" : "нет"} | ${s.hasNavMarkup ? "да" : "нет"} | ${s.noFlashPass ? "PASS" : "FAIL"} |`
    ),
    "",
    "## Проверка работы SSR без JavaScript (`Emulation.setScriptExecutionDisabled`)",
    "",
    "| Маршрут | H1 заголовок | Навигационных ссылок | Длина текста | Переполнение | Итог |",
    "|---|---|---:|---:|:---:|:---:|",
    ...noJsResults.map(
      (n) =>
        `| \`${n.expectedPath}\` | ${n.h1Text || "—"} | ${n.navLinks} | ${n.textLen} | ${n.hasOverflow ? "да" : "нет"} | ${n.usableWithoutJS ? "PASS" : "FAIL"} |`
    ),
    "",
    "## Матрица всех ролей (UI5 — `docs/ui/final/`)",
    "",
    "| Роль | Экран | Тема | Viewport | Axe (crit) | Переполнение | Скриншот |",
    "|---|---|---|---:|---:|:---:|---|",
    ...finalResults.map(
      (r) =>
        `| ${r.role || "—"} | \`${r.path}\` | ${r.theme} | ${r.viewport} | ${r.axeViolations} (${r.critOrSeriousAxe}) | ${r.hasHorizontalOverflow ? "ДА" : "нет"} | [PNG](./${path.basename(r.screenshot)}) |`
    ),
    "",
    "## Ключевые списки, формы и карточки Stage 4 (`docs/ui/stage-4/`)",
    "",
    "| Экран | Маршрут | Тема | Viewport | Axe (crit) | Переполнение | Скриншот |",
    "|---|---|---|---:|---:|:---:|---|",
    ...stage4Results.map(
      (r) =>
        `| ${r.screen} | \`${r.path}\` | ${r.theme} | ${r.viewport} | ${r.axeViolations} (${r.critOrSeriousAxe}) | ${r.hasHorizontalOverflow ? "ДА" : "нет"} | [PNG](../stage-4/${path.basename(r.screenshot)}) |`
    ),
    "",
  ];

  fs.writeFileSync(path.join(finalDir, "INDEX.md"), lines.join("\n"), "utf8");
}

async function main() {
  const stage4Dir = path.join(process.cwd(), "docs", "ui", "stage-4");
  const finalDir = path.join(process.cwd(), "docs", "ui", "final");
  const reportsDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(stage4Dir, { recursive: true });
  fs.mkdirSync(finalDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  const axePath = path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js");
  const axeSource = fs.readFileSync(axePath, "utf8");

  const port = 3014;
  const cdpPort = 9232;
  let fixture = null;
  let serverProc = null;
  let browserProc = null;
  let tmpProfile = null;

  try {
    await cleanupOrphanedData();
    fixture = await seedFixture();

    const tokens = new Map();
    const allScreens = [...fixture.stage4Screens, ...fixture.finalScreens];
    for (const s of allScreens) {
      const k = s.user.id + (s.centerRole ? `:${s.centerRole}` : "");
      if (!tokens.has(k)) {
        const claims = s.centerId
          ? { activeCenterId: s.centerId, activeCenterRole: s.centerRole }
          : {};
        tokens.set(k, await createSessionToken(s.user, claims));
      }
    }

    serverProc = await startNextServer(port);
    const directorUser = fixture.users.find((u) => u.email.startsWith("director."));
    const superadminUser = fixture.users.find((u) => u.email.startsWith("superadmin."));
    const directorToken = tokens.get(`${directorUser.id}:DIRECTOR`);
    const superadminToken = tokens.get(superadminUser.id);

    console.log("Running SSR no-flash dark theme checks...");
    const ssrResults = await runSSRChecks(port, directorToken, superadminToken);

    const browserPath = findBrowser();
    console.log(`Launching headless browser: ${browserPath}`);
    tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), "edarschi-ui5-"));
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

    console.log("Running SSR no-JS usability checks...");
    const noJsResults = await runNoJSChecks(send, port, directorToken, superadminToken);

    const stage4Results = await captureBatch({
      screens: fixture.stage4Screens,
      outDir: stage4Dir,
      dirRel: "docs/ui/stage-4",
      port,
      tokens,
      send,
      browserErrors,
      axeSource,
    });

    const finalResults = await captureBatch({
      screens: fixture.finalScreens,
      outDir: finalDir,
      dirRel: "docs/ui/final",
      port,
      tokens,
      send,
      browserErrors,
      axeSource,
    });

    writeFinalIndexMd(finalDir, stage4Results, finalResults, ssrResults, noJsResults);

    const reportPath = path.join(reportsDir, "final-audit.json");
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          ssrResults,
          noJsResults,
          stage4Results,
          finalResults,
        },
        null,
        2
      )
    );
    console.log(`Audit report saved to ${reportPath}`);
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
    if (fixture) {
      await cleanupByCenterIds(
        [fixture.center1.id, fixture.center2.id],
        fixture.users.map((u) => u.id),
        [fixture.planPro.id]
      );
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Stage 4 / UI5 audit runner failed:", err);
  process.exit(1);
});
